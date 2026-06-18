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
    await this.driverCommand({ command: 'tap', ...this.serializeFinder(finder) }, timeoutMs);
  }

  /** Type `text` into the currently focused text field.
   *  Internally taps `finder` first to focus it. */
  async enterText(finder: Finder, text: string, timeoutMs?: number): Promise<void> {
    await this.tap(finder, timeoutMs);
    if (!this.textEntryEmulationEnabled) {
      await this.driverCommand({ command: 'set_text_entry_emulation', enabled: 'true' }, timeoutMs);
      this.textEntryEmulationEnabled = true;
    }
    await this.driverCommand({ command: 'enter_text', text }, timeoutMs);
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
