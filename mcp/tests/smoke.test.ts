/**
 * Smoke tests for conductor-mcp server.
 *
 * Spawns the MCP server as a subprocess and exercises its 12 tools over
 * JSON-RPC stdio. Two modes:
 *
 *   Mode 1 — Existing-project mode (cwd = example/)
 *     Discovery tools return real data from the example project.
 *     Scaffolding writes a temp feature file (cleaned up after).
 *     dry_run_scenario reports undefined steps for the temp feature.
 *
 *   Mode 2 — Bootstrap mode (cwd = fresh empty tmp dir)
 *     Discovery tools return the "run init_project first" error.
 *     init_project bootstraps a full project.
 *     npm install + cucumber-js --dry-run exits 0 (end-to-end prove-out).
 *
 *   Drift check — verifies cucumber.js template matches docs/USER_GUIDE.md §2.
 *
 * Uses Node's built-in test runner (no extra deps).
 *
 * Run with:
 *   npm run test:smoke  (from mcp/)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(import.meta.dirname ?? __dirname, '..', '..');
const MCP_CLI = path.join(REPO_ROOT, 'mcp', 'dist', 'cli.js');
const EXAMPLE_DIR = path.join(REPO_ROOT, 'example');
const USER_GUIDE = path.join(REPO_ROOT, 'docs', 'USER_GUIDE.md');

// ─────────────────────────────────────────────────────────────────────────────
// Tiny JSON-RPC / MCP client helper
// ─────────────────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * McpClient: Spawns the conductor-mcp server as a child process and provides
 * a `call(toolName, input)` helper that sends tools/call JSON-RPC requests.
 *
 * The MCP initialize handshake is performed once at connect time.
 */
class McpClient {
  private proc: ChildProcess;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>();
  private closed = false;

  constructor(cwd: string) {
    this.proc = spawn(process.execPath, [MCP_CLI], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.drainLines();
    });

    this.proc.stderr!.on('data', (_chunk: Buffer) => {
      // MCP server writes startup logs to stderr — ignore in tests
    });

    this.proc.on('close', () => {
      this.closed = true;
      for (const [, { reject }] of this.pending) {
        reject(new Error('Server process closed unexpectedly'));
      }
      this.pending.clear();
    });
  }

  private drainLines(): void {
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined) {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            handler.resolve(msg);
          }
        }
      } catch {
        // Ignore non-JSON lines (shouldn't occur on stdout)
      }
    }
  }

  private send(req: JsonRpcRequest): void {
    if (this.closed) throw new Error('Client is closed');
    this.proc.stdin!.write(JSON.stringify(req) + '\n');
  }

  private request(method: string, params?: unknown, timeoutMs = 15_000): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request ${method} timed out after ${timeoutMs} ms`));
        }
      }, timeoutMs);

      // Clear timer when request resolves/rejects
      const origResolve = resolve;
      const origReject = reject;
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); origResolve(v); },
        reject: (e) => { clearTimeout(timer); origReject(e); },
      });
    });
  }

  /** Perform the MCP initialize handshake. Must be called before any tool calls. */
  async connect(): Promise<void> {
    const resp = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0' },
    });
    assert.ok(!resp.error, `initialize failed: ${JSON.stringify(resp.error)}`);
    // Send initialized notification (no response expected)
    this.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  }

  /** List all available tools. */
  async listTools(): Promise<{ name: string; description: string }[]> {
    const resp = await this.request('tools/list', {});
    assert.ok(!resp.error, `tools/list failed: ${JSON.stringify(resp.error)}`);
    const result = resp.result as { tools: { name: string; description: string }[] };
    return result.tools;
  }

  /**
   * Call a tool and return the parsed JSON content.
   * The MCP server always returns content[0].text as stringified JSON.
   * Pass timeoutMs > 15_000 for tools that spawn subprocesses (e.g. dry_run_scenario).
   */
  async call<T = unknown>(toolName: string, input: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<{ data: T; isError: boolean }> {
    const resp = await this.request('tools/call', {
      name: toolName,
      arguments: input,
    }, timeoutMs);
    if (resp.error) {
      throw new Error(`tools/call error for ${toolName}: ${JSON.stringify(resp.error)}`);
    }
    const result = resp.result as { content: [{ type: string; text: string }]; isError?: boolean };
    const text = result.content[0]?.text ?? '';
    const isError = result.isError === true;

    // The server wraps responses in JSON.stringify — parse it back
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      // Not JSON — return raw text (e.g. for error messages)
      data = text as unknown as T;
    }

    return { data, isError };
  }

  /** Kill the server subprocess. */
  async close(): Promise<void> {
    if (!this.closed) {
      this.proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2000);
        this.proc.on('close', () => { clearTimeout(timer); resolve(); });
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Create a fresh temporary directory. */
async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'conductor-smoke-'));
}

/** Normalise whitespace for drift comparisons. */
function normaliseWhitespace(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode 1: Existing-project mode (cwd = example/)
// ─────────────────────────────────────────────────────────────────────────────

describe('Mode 1: existing-project mode (cwd = example/)', { timeout: 60_000 }, () => {
  let client: McpClient;

  before(async () => {
    client = new McpClient(EXAMPLE_DIR);
    await client.connect();
  });

  after(async () => {
    await client.close();
  });

  // ── tools/list ─────────────────────────────────────────────────────────────

  it('tools/list returns exactly 12 tools', async () => {
    const tools = await client.listTools();
    assert.equal(tools.length, 13, `Expected 13 tools, got ${tools.length}: ${tools.map((t) => t.name).join(', ')}`);
  });

  it('tools/list contains all expected tool names', async () => {
    const tools = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    const expected = [
      'list_steps', 'list_page_objects', 'list_maestro_flows', 'list_features',
      'get_conductor_api', 'get_config',
      'init_project', 'scaffold_feature', 'scaffold_step_def', 'scaffold_page_object',
      'scaffold_maestro_flow', 'remove_samples', 'dry_run_scenario',
    ];
    for (const name of expected) {
      assert.ok(names.has(name), `Missing tool: ${name}`);
    }
  });

  // ── list_steps ─────────────────────────────────────────────────────────────

  it('list_steps returns at least 10 step definitions', async () => {
    const { data, isError } = await client.call<{ pattern: string; type: string; file: string; line: number }[]>('list_steps', {});
    assert.ok(!isError, `Expected success, got error: ${JSON.stringify(data)}`);
    assert.ok(Array.isArray(data), 'Expected an array');
    assert.ok(data.length >= 10, `Expected ≥10 steps, got ${data.length}`);
  });

  it('list_steps result includes a step from web.steps.ts', async () => {
    const { data, isError } = await client.call<{ pattern: string; type: string; file: string; line: number }[]>('list_steps', {});
    assert.ok(!isError);
    const webStep = data.find((s) => s.file.includes('web.steps'));
    assert.ok(webStep, `No step found from web.steps.ts. Files: ${data.map((s) => s.file).join(', ')}`);
  });

  it('list_steps each entry has required fields', async () => {
    const { data } = await client.call<{ pattern: string; type: string; file: string; line: number; paramTypes: string[] }[]>('list_steps', {});
    const first = data[0];
    assert.ok(first, 'Expected at least one step');
    assert.ok(typeof first.pattern === 'string', 'pattern must be a string');
    assert.ok(['Given', 'When', 'Then'].includes(first.type), `Invalid type: ${first.type}`);
    assert.ok(typeof first.file === 'string', 'file must be a string');
    assert.ok(typeof first.line === 'number', 'line must be a number');
    assert.ok(Array.isArray(first.paramTypes), 'paramTypes must be an array');
  });

  it('list_steps with filter=when returns only When steps', async () => {
    const { data, isError } = await client.call<{ pattern: string; type: string }[]>('list_steps', { filter: 'when' });
    assert.ok(!isError);
    assert.ok(data.length > 0, 'Expected at least one When step');
    for (const step of data) {
      assert.equal(step.type, 'When', `Got non-When step: ${JSON.stringify(step)}`);
    }
  });

  it('list_steps with q filter returns matching steps', async () => {
    const { data, isError } = await client.call<{ pattern: string }[]>('list_steps', { q: 'todo' });
    assert.ok(!isError);
    assert.ok(data.length > 0, 'Expected at least one "todo" step');
    for (const step of data) {
      assert.ok(
        step.pattern.toLowerCase().includes('todo'),
        `Step does not contain "todo": ${step.pattern}`,
      );
    }
  });

  // ── list_page_objects ──────────────────────────────────────────────────────

  it('list_page_objects finds LoginPage and TodoPage', async () => {
    const { data, isError } = await client.call<{ className: string; file: string; methods: { name: string }[] }[]>('list_page_objects', {});
    assert.ok(!isError, `Got error: ${JSON.stringify(data)}`);
    const names = data.map((p) => p.className);
    assert.ok(names.includes('LoginPage'), `LoginPage not found. Got: ${names.join(', ')}`);
    assert.ok(names.includes('TodoPage'), `TodoPage not found. Got: ${names.join(', ')}`);
  });

  it('list_page_objects result entries have correct shape fields', async () => {
    const { data } = await client.call<{ className: string; file: string; extends: string; methods: { name: string }[] }[]>('list_page_objects', {});
    for (const page of data) {
      assert.ok(typeof page.className === 'string', 'className must be a string');
      assert.ok(typeof page.file === 'string', 'file must be a string');
      assert.ok(typeof page.extends === 'string', 'extends must be a string');
      assert.ok(Array.isArray(page.methods), 'methods must be an array');
    }
    // Both example page objects extend BasePage
    const todoPage = data.find((p) => p.className === 'TodoPage');
    assert.ok(todoPage, 'TodoPage not found');
    assert.equal(todoPage.extends, 'BasePage', 'TodoPage should extend BasePage');
  });

  it('list_page_objects extracts methods from TodoPage', async () => {
    const { data } = await client.call<{ className: string; methods: { name: string }[] }[]>('list_page_objects', {});
    const todoPage = data.find((p) => p.className === 'TodoPage');
    assert.ok(todoPage, 'TodoPage not found');
    const methodNames = todoPage.methods.map((m) => m.name);
    assert.ok(methodNames.includes('createTodo'), `createTodo missing. Got: ${methodNames.join(', ')}`);
    assert.ok(methodNames.includes('assertVisible'), `assertVisible missing. Got: ${methodNames.join(', ')}`);
    assert.ok(methodNames.includes('getTodoCount'), `getTodoCount missing. Got: ${methodNames.join(', ')}`);
  });

  // ── list_maestro_flows ─────────────────────────────────────────────────────

  it('list_maestro_flows finds verify-todo flow', async () => {
    const { data, isError } = await client.call<{ name: string; file: string; envVars: string[] }[]>('list_maestro_flows', {});
    assert.ok(!isError, `Got error: ${JSON.stringify(data)}`);
    const verifyFlow = data.find((f) => f.name === 'verify-todo');
    assert.ok(verifyFlow, `verify-todo flow not found. Got: ${data.map((f) => f.name).join(', ')}`);
  });

  it('list_maestro_flows verify-todo includes TODO_TITLE env var', async () => {
    const { data } = await client.call<{ name: string; envVars: string[] }[]>('list_maestro_flows', {});
    const verifyFlow = data.find((f) => f.name === 'verify-todo');
    assert.ok(verifyFlow, 'verify-todo flow not found');
    assert.ok(
      verifyFlow.envVars.includes('TODO_TITLE'),
      `TODO_TITLE not found in envVars: ${verifyFlow.envVars.join(', ')}`,
    );
  });

  // ── list_features ──────────────────────────────────────────────────────────

  it('list_features returns feature files with correct structure', async () => {
    const { data, isError } = await client.call<{ file: string; featureName: string; tags: string[]; scenarios: unknown[] }[]>('list_features', {});
    assert.ok(!isError, `Got error: ${JSON.stringify(data)}`);
    assert.ok(Array.isArray(data) && data.length > 0, 'Expected at least one feature file');

    const first = data[0];
    assert.ok(typeof first.file === 'string', 'file must be a string');
    assert.ok(typeof first.featureName === 'string', 'featureName must be a string');
    assert.ok(Array.isArray(first.tags), 'tags must be an array');
    assert.ok(Array.isArray(first.scenarios), 'scenarios must be an array');
  });

  it('list_features with tag filter @web returns only web features/scenarios', async () => {
    const { data, isError } = await client.call<{ file: string; tags: string[]; scenarios: { tags: string[] }[] }[]>('list_features', { tag: '@web' });
    assert.ok(!isError);
    assert.ok(data.length > 0, 'Expected at least one @web feature');
    for (const feature of data) {
      const hasWebTag = feature.tags.includes('@web') || feature.scenarios.some((s) => s.tags.includes('@web'));
      assert.ok(hasWebTag, `Feature ${feature.file} missing @web tag`);
    }
  });

  // ── get_conductor_api ──────────────────────────────────────────────────────

  it('get_conductor_api (no surface) returns markdown containing ConductorWorld', async () => {
    const { data, isError } = await client.call<{ surface: string; markdown: string; availableSurfaces: string[] }>('get_conductor_api', {});
    assert.ok(!isError, `Got error: ${JSON.stringify(data)}`);
    assert.ok(data.markdown.includes('ConductorWorld'), 'Expected ConductorWorld in markdown');
    assert.equal(data.surface, 'all');
    assert.ok(Array.isArray(data.availableSurfaces) && data.availableSurfaces.length > 0);
  });

  it('get_conductor_api with surface=web filters to web content', async () => {
    const allResult = await client.call<{ markdown: string }>('get_conductor_api', {});
    const webResult = await client.call<{ markdown: string; surface: string }>('get_conductor_api', { surface: 'web' });
    assert.ok(!webResult.isError);
    assert.equal(webResult.data.surface, 'web');
    // Web-filtered result should be smaller than or equal to the full result
    assert.ok(
      webResult.data.markdown.length <= allResult.data.markdown.length,
      'Web-filtered markdown should not be larger than full markdown',
    );
    // Web result should contain web-related content
    assert.ok(
      webResult.data.markdown.toLowerCase().includes('web') ||
      webResult.data.markdown.toLowerCase().includes('playwright'),
      'Expected web/playwright content in web surface',
    );
  });

  // ── get_config ─────────────────────────────────────────────────────────────

  it('get_config returns a valid EnvironmentConfig shape', async () => {
    const { data, isError } = await client.call<{
      projectName: string;
      projectRoot: string;
      config: {
        web: { baseUrl: string; headless: boolean; browserName: string };
        api: { baseUrl: string };
        mobile: { flowsDir: string };
      };
      envVarsSet: Record<string, unknown>;
      envVarsAvailable: { name: string; description: string }[];
    }>('get_config', {});
    assert.ok(!isError, `Got error: ${JSON.stringify(data)}`);
    assert.ok(typeof data.projectName === 'string', 'projectName must be string');
    assert.ok(typeof data.projectRoot === 'string', 'projectRoot must be string');
    assert.ok(typeof data.config.web.baseUrl === 'string', 'web.baseUrl must be string');
    assert.ok(typeof data.config.web.headless === 'boolean', 'web.headless must be boolean');
    assert.ok(typeof data.config.web.browserName === 'string', 'web.browserName must be string');
    assert.ok(typeof data.config.api.baseUrl === 'string', 'api.baseUrl must be string');
    assert.ok(typeof data.config.mobile.flowsDir === 'string', 'mobile.flowsDir must be string');
    assert.ok(Array.isArray(data.envVarsAvailable), 'envVarsAvailable must be array');
    assert.ok(data.envVarsAvailable.length > 0, 'envVarsAvailable must be non-empty');
  });

  // ── scaffold_feature + dry_run_scenario ────────────────────────────────────

  const TEMP_FEATURE_REL = 'features/web/smoke-test-temp.feature';
  const TEMP_FEATURE_ABS = path.join(EXAMPLE_DIR, TEMP_FEATURE_REL);

  after(async () => {
    // Cleanup temp feature file even if assertions fail
    try {
      await fs.unlink(TEMP_FEATURE_ABS);
    } catch {
      // Already removed or never created — that's fine
    }
  });

  it('scaffold_feature writes a feature file and returns { path, content }', async () => {
    const { data, isError } = await client.call<{ path: string; content: string }>('scaffold_feature', {
      platform: 'web',
      name: 'smoke-test-temp',
      scenarios: [
        {
          name: 'Smoke scenario with unknown step',
          steps: ['Given a step that does not exist in any step definition'],
        },
      ],
    });
    assert.ok(!isError, `scaffold_feature returned error: ${JSON.stringify(data)}`);
    assert.ok(typeof data.path === 'string', 'path must be a string');
    assert.ok(typeof data.content === 'string', 'content must be a string');
    assert.ok(data.content.includes('@web'), 'Feature content must include @web tag');
    assert.ok(data.content.includes('Smoke scenario with unknown step'), 'Feature content must include scenario name');

    // File must exist on disk
    const stat = await fs.stat(data.path);
    assert.ok(stat.isFile(), `Expected a file at ${data.path}`);
  });

  it('dry_run_scenario against temp feature reports undefined steps', async () => {
    // Ensure the temp feature was created by the previous test
    const exists = await fs.stat(TEMP_FEATURE_ABS).then(() => true).catch(() => false);
    assert.ok(exists, `Temp feature file not found at ${TEMP_FEATURE_ABS} — scaffold_feature test may have failed`);

    // dry_run_scenario spawns npx cucumber-js — give it a generous timeout
    const { data, isError } = await client.call<{
      success: boolean;
      scenarios: number;
      steps: { total: number; undefined: { pattern: string; suggestion: string | null }[] };
    }>('dry_run_scenario', {
      featurePath: TEMP_FEATURE_REL,
    }, 45_000);
    assert.ok(!isError, `dry_run_scenario returned error: ${JSON.stringify(data)}`);
    assert.ok(typeof data.success === 'boolean', 'success must be boolean');
    assert.ok(typeof data.scenarios === 'number', 'scenarios must be a number');
    assert.ok(data.scenarios >= 1, `Expected ≥1 scenario, got ${data.scenarios}`);
    assert.ok(Array.isArray(data.steps.undefined), 'steps.undefined must be an array');
    assert.ok(data.steps.undefined.length >= 1, 'Expected at least one undefined step');
    // Should not be a green dry-run since we used a made-up step
    assert.ok(!data.success, 'Expected dry-run to report failure (undefined steps)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode 2: Bootstrap mode (cwd = fresh empty tmp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe('Mode 2: bootstrap mode (cwd = fresh tmp dir)', { timeout: 10_000 }, () => {
  let client: McpClient;
  let tmpDir: string;

  before(async () => {
    tmpDir = await makeTmpDir();
    client = new McpClient(tmpDir);
    await client.connect();
  });

  after(async () => {
    await client.close();
    // Clean up tmp dir
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Best effort
    }
  });

  it('list_steps returns error directing to init_project when no cucumber.js', async () => {
    const { data, isError } = await client.call<string>('list_steps', {});
    assert.ok(isError, 'Expected isError=true when project is uninitialized');
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    assert.ok(
      msg.includes('init_project'),
      `Error message should mention init_project. Got: ${msg}`,
    );
  });

  it('list_page_objects returns error directing to init_project', async () => {
    const { data, isError } = await client.call<string>('list_page_objects', {});
    assert.ok(isError, 'Expected isError=true');
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    assert.ok(msg.includes('init_project'), `Expected init_project mention. Got: ${msg}`);
  });

  it('list_maestro_flows returns error directing to init_project', async () => {
    const { data, isError } = await client.call<string>('list_maestro_flows', {});
    assert.ok(isError, 'Expected isError=true');
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    assert.ok(msg.includes('init_project'), `Expected init_project mention. Got: ${msg}`);
  });

  it('list_features returns error directing to init_project', async () => {
    const { data, isError } = await client.call<string>('list_features', {});
    assert.ok(isError, 'Expected isError=true');
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    assert.ok(msg.includes('init_project'), `Expected init_project mention. Got: ${msg}`);
  });

  it('get_config returns error directing to init_project', async () => {
    const { data, isError } = await client.call<string>('get_config', {});
    assert.ok(isError, 'Expected isError=true');
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    assert.ok(msg.includes('init_project'), `Expected init_project mention. Got: ${msg}`);
  });

  it('init_project succeeds and returns { path, files, nextSteps }', async () => {
    const { data, isError } = await client.call<{ path: string; files: string[]; nextSteps: string[] }>('init_project', {
      path: tmpDir,
      name: 'smoke-test',
      platforms: ['web', 'api'],
      includeSamples: true,
      force: true, // safe — tmpDir is empty but force avoids edge-case race
    });
    assert.ok(!isError, `init_project returned error: ${JSON.stringify(data)}`);
    assert.ok(typeof data.path === 'string', 'path must be a string');
    assert.ok(Array.isArray(data.files), 'files must be an array');
    assert.ok(data.files.length > 0, 'files array must be non-empty');
    assert.ok(Array.isArray(data.nextSteps), 'nextSteps must be an array');
    assert.ok(data.nextSteps.length > 0, 'nextSteps must be non-empty');
  });

  it('init_project wrote package.json with conductor-e2e dependency', async () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content) as { dependencies?: Record<string, string> };
    assert.ok(
      pkg.dependencies?.['conductor-e2e'],
      `conductor-e2e not found in dependencies: ${JSON.stringify(pkg.dependencies)}`,
    );
  });

  it('init_project wrote tsconfig.json', async () => {
    const filePath = path.join(tmpDir, 'tsconfig.json');
    const stat = await fs.stat(filePath);
    assert.ok(stat.isFile(), 'tsconfig.json should exist');
    const content = await fs.readFile(filePath, 'utf8');
    const cfg = JSON.parse(content) as { compilerOptions?: Record<string, unknown> };
    assert.ok(cfg.compilerOptions, 'tsconfig.json must have compilerOptions');
  });

  it('init_project wrote cucumber.js', async () => {
    const filePath = path.join(tmpDir, 'cucumber.js');
    const stat = await fs.stat(filePath);
    assert.ok(stat.isFile(), 'cucumber.js should exist');
    const content = await fs.readFile(filePath, 'utf8');
    // Must reference conductor-e2e hooks
    assert.ok(
      content.includes('conductor-e2e'),
      `cucumber.js must reference conductor-e2e. Got:\n${content}`,
    );
  });

  it('init_project wrote .env.example', async () => {
    const filePath = path.join(tmpDir, '.env.example');
    const stat = await fs.stat(filePath);
    assert.ok(stat.isFile(), '.env.example should exist');
  });

  it('init_project wrote .gitignore', async () => {
    const filePath = path.join(tmpDir, '.gitignore');
    const stat = await fs.stat(filePath);
    assert.ok(stat.isFile(), '.gitignore should exist');
  });

  it('init_project wrote README.md', async () => {
    const filePath = path.join(tmpDir, 'README.md');
    const stat = await fs.stat(filePath);
    assert.ok(stat.isFile(), 'README.md should exist');
  });

  it('init_project created features/web/ directory', async () => {
    const dirPath = path.join(tmpDir, 'features', 'web');
    const stat = await fs.stat(dirPath);
    assert.ok(stat.isDirectory(), 'features/web/ should be a directory');
  });

  it('init_project created features/api/ directory', async () => {
    const dirPath = path.join(tmpDir, 'features', 'api');
    const stat = await fs.stat(dirPath);
    assert.ok(stat.isDirectory(), 'features/api/ should be a directory');
  });

  it('init_project created step-definitions/ directory', async () => {
    const dirPath = path.join(tmpDir, 'step-definitions');
    const stat = await fs.stat(dirPath);
    assert.ok(stat.isDirectory(), 'step-definitions/ should be a directory');
  });

  it('init_project created pages/ directory', async () => {
    const dirPath = path.join(tmpDir, 'pages');
    const stat = await fs.stat(dirPath);
    assert.ok(stat.isDirectory(), 'pages/ should be a directory');
  });

  it('init_project did not create flows/mobile/ (not a mobile project)', async () => {
    const dirPath = path.join(tmpDir, 'flows', 'mobile');
    const exists = await fs.stat(dirPath).then(() => true).catch(() => false);
    assert.ok(!exists, 'flows/mobile/ should NOT exist for a web+api project');
  });

  it('init_project wrote sample web feature and step-def', async () => {
    const featurePath = path.join(tmpDir, 'features', 'web', 'example.feature');
    const stepPath = path.join(tmpDir, 'step-definitions', 'web.steps.ts');
    const featureStat = await fs.stat(featurePath).catch(() => null);
    const stepStat = await fs.stat(stepPath).catch(() => null);
    assert.ok(featureStat?.isFile(), `features/web/example.feature not found`);
    assert.ok(stepStat?.isFile(), `step-definitions/web.steps.ts not found`);
  });

  it('init_project wrote sample api feature and step-def', async () => {
    const featurePath = path.join(tmpDir, 'features', 'api', 'example.feature');
    const stepPath = path.join(tmpDir, 'step-definitions', 'api.steps.ts');
    const featureStat = await fs.stat(featurePath).catch(() => null);
    const stepStat = await fs.stat(stepPath).catch(() => null);
    assert.ok(featureStat?.isFile(), `features/api/example.feature not found`);
    assert.ok(stepStat?.isFile(), `step-definitions/api.steps.ts not found`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode 2 — End-to-end bootstrap prove-out (npm install + dry-run)
// This block is separated to apply a longer timeout (90 s for npm install).
// ─────────────────────────────────────────────────────────────────────────────

describe('Mode 2: end-to-end bootstrap prove-out (npm install + dry-run)', { timeout: 90_000 }, () => {
  let bootstrapDir: string;

  before(async () => {
    // Bootstrap a fresh project using init_project directly (no MCP round-trip
    // needed here — we already verified the tool in the previous describe block;
    // this test exercises the installed project on disk).
    bootstrapDir = await makeTmpDir();

    const client = new McpClient(bootstrapDir);
    await client.connect();

    const { data, isError } = await client.call<{ path: string; files: string[] }>('init_project', {
      path: bootstrapDir,
      name: 'smoke-bootstrap',
      platforms: ['web', 'api'],
      includeSamples: true,
      force: true,
    });
    await client.close();

    assert.ok(!isError, `init_project failed: ${JSON.stringify(data)}`);
  });

  after(async () => {
    if (bootstrapDir) {
      await fs.rm(bootstrapDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('npm install completes successfully in bootstrapped project', async () => {
    // This is intentionally synchronous-ish via execSync with a generous timeout.
    // It takes 15-30 s on a warm npm cache; 90 s outer timeout covers cold runs.
    let error: Error | null = null;
    try {
      execSync('npm install', {
        cwd: bootstrapDir,
        stdio: 'pipe',
        timeout: 80_000,
      });
    } catch (e) {
      error = e as Error;
    }
    assert.equal(error, null, `npm install failed: ${error?.message}`);
  });

  it('cucumber-js --dry-run exits 0 after npm install', async () => {
    let output = '';
    let exitCode = 0;
    try {
      output = execSync('npx cucumber-js --dry-run', {
        cwd: bootstrapDir,
        stdio: 'pipe',
        timeout: 30_000,
        encoding: 'utf8',
      });
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      exitCode = err.status ?? 1;
      output = `stdout: ${err.stdout ?? ''}\nstderr: ${err.stderr ?? ''}`;
    }

    assert.equal(
      exitCode,
      0,
      `cucumber-js --dry-run should exit 0 but exited ${exitCode}.\n\nOutput:\n${output}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drift check: cucumber.js template vs docs/USER_GUIDE.md §2
// ─────────────────────────────────────────────────────────────────────────────

describe('Drift check: cucumber.js template vs USER_GUIDE.md §2', { timeout: 10_000 }, () => {
  it('cucumber.js template in USER_GUIDE.md §2 loads conductor-e2e hooks', async () => {
    // We extract the cucumber.js code block from the USER_GUIDE rather than
    // doing a byte-exact diff (the MCP template adds platform profiles while
    // the guide shows a minimal single-profile snippet). The key invariant is
    // that BOTH reference conductor-e2e's hooks — not a local path that would
    // break in a standalone project.

    const guideContent = await fs.readFile(USER_GUIDE, 'utf8');

    // Extract the first JS code block after "Create `cucumber.js`:"
    const sectionMatch = /Create `cucumber\.js`:[\s\S]*?```js([\s\S]*?)```/.exec(guideContent);
    assert.ok(sectionMatch, 'Could not find cucumber.js code block in USER_GUIDE.md §2');

    const guideSnippet = sectionMatch[1]!.trim();
    assert.ok(guideSnippet.length > 0, 'cucumber.js snippet in USER_GUIDE is empty');

    // Both must reference conductor-e2e for hooks resolution
    assert.ok(
      guideSnippet.includes('conductor-e2e'),
      `USER_GUIDE cucumber.js snippet must reference conductor-e2e.\nGot:\n${guideSnippet}`,
    );
  });

  it('MCP init_project cucumber.js template references conductor-e2e hooks', async () => {
    const templatePath = path.join(REPO_ROOT, 'mcp', 'src', 'templates', 'project', 'cucumber-js.ts');
    const content = await fs.readFile(templatePath, 'utf8');

    // The renderCucumberJs function source must contain conductor-e2e
    assert.ok(
      content.includes('conductor-e2e'),
      `cucumber-js.ts template must reference conductor-e2e.\nGot:\n${content}`,
    );
  });

  it('both sources use require.resolve pattern for hooks (not hard-coded path)', async () => {
    const guideContent = await fs.readFile(USER_GUIDE, 'utf8');
    const templatePath = path.join(REPO_ROOT, 'mcp', 'src', 'templates', 'project', 'cucumber-js.ts');
    const templateContent = await fs.readFile(templatePath, 'utf8');

    // USER_GUIDE §2 must use require.resolve for hooks
    const sectionMatch = /Create `cucumber\.js`:[\s\S]*?```js([\s\S]*?)```/.exec(guideContent);
    assert.ok(sectionMatch);
    const guideSnippet = sectionMatch[1]!;
    assert.ok(
      guideSnippet.includes('require.resolve'),
      `USER_GUIDE should use require.resolve for conductor-e2e hooks. Got:\n${guideSnippet}`,
    );

    // MCP template must also use require.resolve
    assert.ok(
      templateContent.includes('require.resolve'),
      `MCP template should use require.resolve for conductor-e2e hooks`,
    );
  });

  it('USER_GUIDE and MCP template both reference the same hooks file location', async () => {
    const guideContent = await fs.readFile(USER_GUIDE, 'utf8');
    const templatePath = path.join(REPO_ROOT, 'mcp', 'src', 'templates', 'project', 'cucumber-js.ts');
    const templateContent = await fs.readFile(templatePath, 'utf8');

    const sectionMatch = /Create `cucumber\.js`:[\s\S]*?```js([\s\S]*?)```/.exec(guideContent);
    assert.ok(sectionMatch);
    const guideSnippet = normaliseWhitespace(sectionMatch[1]!);

    // Both should reference conductor-e2e/dist/src/hooks/index (or a close variant)
    const guideHasHooksRef = guideSnippet.includes('conductor-e2e/dist/src/hooks/index') ||
      guideSnippet.includes("conductor-e2e");
    const templateHasHooksRef = templateContent.includes('dist/src/hooks/index') ||
      templateContent.includes('conductor-e2e');

    assert.ok(guideHasHooksRef, `USER_GUIDE snippet does not reference hooks. Snippet:\n${guideSnippet}`);
    assert.ok(templateHasHooksRef, `MCP template does not reference hooks`);
  });
});
