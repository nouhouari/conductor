import { spawn, ChildProcess, execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import WebSocket from 'ws';
import type { EnvironmentConfig, FlutterDesktopConfig } from '../../config/types';

/**
 * FlutterDesktopDriver
 *
 * Drives a Flutter desktop app (built with `lib/main_test.dart` calling
 * `enableFlutterDriverExtension()`) by:
 *   1. Spawning the executable.
 *   2. Reading the Dart VM service URL printed on stdout.
 *   3. Opening a WebSocket to the VM service.
 *   4. Calling the `ext.flutter.driver` service extension via JSON-RPC.
 *
 * No Dart side process is involved — this is a pure TypeScript client.
 */

export type FinderType = 'ByValueKey' | 'ByText' | 'ByType' | 'ByTooltipMessage';

export interface Finder {
  type: FinderType;
  value: string;
}

export type OffsetType = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';

export interface Offset {
  dx: number;
  dy: number;
}

export type WaitCondition = 'NoPendingFrames' | 'NoTransientCallbacks' | 'FirstFrameRasterized';

interface PendingRpc {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const VM_URL_REGEX = /(?:Dart VM service|Observatory) is listening on (https?:\/\/[^\s]+)/i;
const STREAM = process.env.DEBUG_FLUTTER_DESKTOP !== '0' && process.env.DEBUG_FLUTTER_DESKTOP !== 'false';

export class FlutterDesktopDriver {
  private readonly cfg: FlutterDesktopConfig;
  private proc: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private isolateId: string | null = null;
  private nextRpcId = 1;
  private pending = new Map<number, PendingRpc>();
  private textEntryEmulationEnabled = false;

  constructor(env: EnvironmentConfig) {
    if (!env.flutterDesktop) {
      throw new Error('No flutterDesktop config. Set config.flutterDesktop with FlutterDesktopConfig.');
    }
    this.cfg = env.flutterDesktop;
  }

  get isLaunched(): boolean {
    return this.proc !== null && this.ws !== null;
  }

  // ─── lifecycle ──────────────────────────────────────────────────────────────

  async launch(): Promise<void> {
    if (this.isLaunched) return;

    const exe = this.cfg.appPath;
    if (!fs.existsSync(exe)) {
      throw new Error(`Flutter desktop executable not found: ${exe}\nBuild it first, e.g. \`flutter build macos --profile -t lib/main_test.dart\`.`);
    }

    const args = [...(this.cfg.extraArgs ?? [])];
    if (this.cfg.vmServicePort) args.push(`--vm-service-port=${this.cfg.vmServicePort}`);

    const launchTimeoutMs = this.cfg.launchTimeoutMs ?? 30_000;
    if (STREAM) process.stderr.write(`\n[flutter-desktop] ▶ launching ${exe}\n`);

    const proc = spawn(exe, args, {
      env: { ...process.env, ...(this.cfg.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    this.proc = proc;

    proc.on('error', (err) => {
      if (STREAM) process.stderr.write(`[flutter-desktop] spawn error: ${err.message}\n`);
    });

    const vmUrl = await this.waitForVmServiceUrl(proc, launchTimeoutMs);
    if (STREAM) process.stderr.write(`[flutter-desktop] VM service: ${vmUrl}\n`);

    await this.connectWebSocket(vmUrl);
    await this.resolveIsolateAndDriverExtension(launchTimeoutMs);
    if (STREAM) process.stderr.write(`[flutter-desktop] ✔ ready (isolate=${this.isolateId})\n`);
  }

  async close(): Promise<void> {
    // Reject any pending RPCs
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('FlutterDesktopDriver closed'));
    }
    this.pending.clear();

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM');
      // Force-kill after 2s
      const proc = this.proc;
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} resolve(); }, 2000);
        proc.once('exit', () => { clearTimeout(t); resolve(); });
      });
    }
    this.proc = null;
    this.isolateId = null;
    this.textEntryEmulationEnabled = false;
  }

  // ─── public actions ─────────────────────────────────────────────────────────

  /** Tap a widget identified by `finder`. */
  async tap(finder: Finder, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand({ command: 'tap', ...this.serializeFinder(finder), timeout: String(t) }, t + 2000);
  }

  /** Type `text` into the currently focused text field.
   *  Emulation must be enabled BEFORE tapping so that `TextInput.setClient`
   *  is captured by the mock — otherwise the mock's _client stays null and
   *  enter_text is silently ignored. */
  async enterText(finder: Finder, text: string, timeoutMs?: number): Promise<void> {
    if (!this.textEntryEmulationEnabled) {
      await this.driverCommand({ command: 'set_text_entry_emulation', enabled: 'true' }, timeoutMs);
      this.textEntryEmulationEnabled = true;
    }
    await this.tap(finder, timeoutMs);
    await this.driverCommand({ command: 'enter_text', text }, timeoutMs);
  }

  /**
   * Send a message to the app's `enableFlutterDriverExtension` data handler
   * and return the response string.  Use this to invoke app-side actions that
   * cannot be driven through the gesture system (e.g. tapping widgets inside
   * a scrollable that blocks flutter_driver's hitTestable() check).
   */
  async requestData(message: string, timeoutMs?: number): Promise<string> {
    const result = await this.driverCommand(
      { command: 'request_data', message },
      timeoutMs
    ) as { message?: string };
    return result.message ?? '';
  }

  /** Read the text of a Text widget at `finder`. */
  async getText(finder: Finder, timeoutMs?: number): Promise<string> {
    const result = await this.driverCommand(
      { command: 'get_text', ...this.serializeFinder(finder) },
      timeoutMs
    ) as { text?: string };
    return result.text ?? '';
  }

  /** Wait for `finder` to resolve to an existing widget. */
  async waitFor(finder: Finder, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand(
      { command: 'waitFor', ...this.serializeFinder(finder), timeout: String(t) },
      t + 2000 // give the wire timeout some headroom over the driver timeout
    );
  }

  /** Wait until `finder` no longer resolves to any widget. */
  async waitForAbsent(finder: Finder, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand(
      { command: 'waitForAbsent', ...this.serializeFinder(finder), timeout: String(t) },
      t + 2000
    );
  }

  /**
   * Take a screenshot of the Flutter app's render surface via the
   * `ext.flutter.driver` `screenshot` command. Returns a PNG path.
   *
   * This goes over the same WebSocket as the rest of the driver — no OS-level
   * screen-recording permissions are required, and only the app surface is
   * captured (not the whole desktop).
   */
  async takeScreenshot(name: string): Promise<string> {
    const outDir = this.cfg.screenshotDir ?? 'reports/screenshots';
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.resolve(outDir, `${name}.png`);

    const result = await this.driverCommand({ command: 'screenshot' }) as { screenshot?: string };
    if (!result?.screenshot) {
      throw new Error('flutter_driver screenshot returned no payload');
    }
    fs.writeFileSync(outPath, Buffer.from(result.screenshot, 'base64'));
    return outPath;
  }

  /** Double-tap a widget identified by `finder`. */
  async doubleTap(finder: Finder, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand({ command: 'double_tap', ...this.serializeFinder(finder), timeout: String(t) }, t + 2000);
  }

  /** Long-press a widget identified by `finder`. */
  async longPress(finder: Finder, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand({ command: 'long_press', ...this.serializeFinder(finder), timeout: String(t) }, t + 2000);
  }

  /**
   * Scroll a Scrollable widget identified by `finder` by (`dx`, `dy`) pixels
   * over `durationMs` milliseconds at `frequency` Hz.
   */
  async scroll(
    finder: Finder,
    dx: number,
    dy: number,
    durationMs?: number,
    frequency?: number,
    timeoutMs?: number
  ): Promise<void> {
    const duration = durationMs ?? 300;
    const freq = frequency ?? 60;
    const wireTimeout = timeoutMs ?? (duration + 5_000);
    await this.driverCommand(
      { command: 'scroll', ...this.serializeFinder(finder), dx, dy, duration, frequency: freq },
      wireTimeout
    );
  }

  /**
   * Scroll until `finder` is visible.
   * `alignment` controls where the widget lands: 0.0 = top edge, 0.5 = center, 1.0 = bottom edge.
   */
  async scrollIntoView(finder: Finder, alignment?: number, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand(
      { command: 'scrollIntoView', ...this.serializeFinder(finder), alignment: alignment ?? 0.0 },
      t + 2000
    );
  }

  /**
   * Clear the text field at `finder` by enabling text-entry emulation,
   * tapping to focus, then setting its value to an empty string.
   */
  async clearText(finder: Finder, timeoutMs?: number): Promise<void> {
    if (!this.textEntryEmulationEnabled) {
      await this.driverCommand({ command: 'set_text_entry_emulation', enabled: 'true' }, timeoutMs);
      this.textEntryEmulationEnabled = true;
    }
    await this.tap(finder, timeoutMs);
    await this.driverCommand({ command: 'enter_text', text: '' }, timeoutMs);
  }

  /**
   * Non-throwing visibility probe: returns `true` if `finder` resolves within
   * `timeoutMs` (default 500 ms), `false` otherwise. Use for conditional
   * assertions instead of `waitFor` when absence is acceptable.
   */
  async isVisible(finder: Finder, timeoutMs?: number): Promise<boolean> {
    try {
      await this.waitFor(finder, timeoutMs ?? 500);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Return the screen coordinates of a point on the widget at `finder`.
   * `offsetType` defaults to `'center'`.
   */
  async getOffset(finder: Finder, offsetType?: OffsetType, timeoutMs?: number): Promise<Offset> {
    const result = await this.driverCommand(
      { command: 'get_offset', ...this.serializeFinder(finder), offsetType: offsetType ?? 'center' },
      timeoutMs
    ) as { dx?: number; dy?: number };
    return { dx: result.dx ?? 0, dy: result.dy ?? 0 };
  }

  /**
   * Wait until a predefined Flutter condition is satisfied — the app-level
   * equivalent of Playwright's `page.waitForLoadState()`.
   *
   *   `'NoPendingFrames'`       — no animation frames scheduled (app is idle)
   *   `'NoTransientCallbacks'`  — no pending transient callbacks
   *   `'FirstFrameRasterized'`  — first frame has been rendered
   */
  async waitForCondition(condition: WaitCondition, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    await this.driverCommand(
      { command: 'waitForCondition', conditionJson: JSON.stringify({ conditionName: condition }), timeout: String(t) },
      t + 2000
    );
  }

  /**
   * Enable or disable Flutter's frame-sync during driver commands. Set to
   * `false` before triggering heavy animations so the driver does not stall
   * waiting for each frame to settle; restore with `setFrameSync(true)` when
   * done. Mirrors disabling CSS transitions in web tests.
   */
  async setFrameSync(enabled: boolean, timeoutMs?: number): Promise<void> {
    await this.driverCommand({ command: 'set_frame_sync', enabled: String(enabled) }, timeoutMs);
  }

  /**
   * NOTE: `isEnabled` (checking whether a widget is interactive) is not part
   * of the `ext.flutter.driver` protocol. Use `requestData()` with an app-side
   * handler that inspects widget state and returns the result as a string.
   */

  // ─── internals ──────────────────────────────────────────────────────────────

  private serializeFinder(finder: Finder): Record<string, string> {
    switch (finder.type) {
      case 'ByValueKey':
        // flutter_driver expects keyValueString + keyValueType ('String' | 'int')
        return {
          finderType: 'ByValueKey',
          keyValueString: finder.value,
          keyValueType: 'String'
        };
      case 'ByText':
        return { finderType: 'ByText', text: finder.value };
      case 'ByType':
        return { finderType: 'ByType', type: finder.value };
      case 'ByTooltipMessage':
        return { finderType: 'ByTooltipMessage', text: finder.value };
    }
  }

  /** Read stdout/stderr until we see a VM service URL or hit the timeout. */
  private waitForVmServiceUrl(proc: ChildProcess, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill('SIGTERM');
        reject(new Error(`Timed out (${timeoutMs}ms) waiting for VM service URL on stdout. Captured:\n${buffer}`));
      }, timeoutMs);

      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        buffer += text;
        if (STREAM) {
          for (const line of text.split('\n')) {
            if (line.trim()) process.stderr.write(`[flutter-desktop]   ${line}\n`);
          }
        }
        const m = buffer.match(VM_URL_REGEX);
        if (m && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(m[1]);
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);

      proc.once('exit', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Process exited (code=${code}) before VM service URL appeared. Captured:\n${buffer}`));
      });
    });
  }

  private connectWebSocket(vmUrl: string): Promise<void> {
    // http(s)://host:port/TOKEN/  →  ws(s)://host:port/TOKEN/ws
    const url = new URL(vmUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    url.pathname += 'ws';
    const wsUrl = url.toString();

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.once('open', () => resolve());
      ws.once('error', (err) => reject(new Error(`Failed to connect to VM service: ${(err as Error).message}`)));
      ws.on('message', (data) => this.onMessage(data));
      ws.on('close', () => {
        // Fail any pending RPCs
        for (const [, p] of this.pending) {
          clearTimeout(p.timer);
          p.reject(new Error('VM service WebSocket closed'));
        }
        this.pending.clear();
      });
    });
  }

  private onMessage(data: WebSocket.RawData): void {
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (typeof msg.id !== 'number') return; // ignore events
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error) {
      pending.reject(new Error(`VM service error (${msg.error.code}): ${msg.error.message}`));
    } else {
      pending.resolve(msg.result);
    }
  }

  /** Send a JSON-RPC method to the VM service and await the response. */
  private rpc(method: string, params: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('VM service WebSocket is not open'));
    }
    const id = this.nextRpcId++;
    const t = timeoutMs ?? this.cfg.defaultTimeoutMs ?? 10_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC ${method} timed out after ${t}ms`));
      }, t);
      this.pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  /** Send an `ext.flutter.driver` command on the resolved isolate. */
  private async driverCommand(command: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    if (!this.isolateId) throw new Error('FlutterDesktopDriver not initialized');
    const result = await this.rpc('ext.flutter.driver', { isolateId: this.isolateId, ...command }, timeoutMs) as {
      isError?: boolean;
      response?: unknown;
      [k: string]: unknown;
    };
    if (result?.isError) {
      throw new Error(`flutter_driver command failed: ${JSON.stringify(result.response ?? result)}`);
    }
    // The ext.flutter.driver result wraps the actual payload in `response`
    return result?.response ?? result;
  }

  private async resolveIsolateAndDriverExtension(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const vm = await this.rpc('getVM', {}) as { isolates?: Array<{ id: string }> };
      const first = vm.isolates?.[0];
      if (first) {
        const isolate = await this.rpc('getIsolate', { isolateId: first.id }) as {
          extensionRPCs?: string[];
        };
        if (isolate.extensionRPCs?.includes('ext.flutter.driver')) {
          this.isolateId = first.id;
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timed out waiting for ext.flutter.driver extension. Did the app call enableFlutterDriverExtension()?`);
  }
}
