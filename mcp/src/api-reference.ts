/**
 * Hand-maintained API reference for conductor-e2e public surface.
 *
 * Keyed by surface name. Each entry is a markdown string with property/method
 * signatures and one-line descriptions. Update this file when the framework API changes.
 *
 * Source of truth: src/world/ConductorWorld.ts, src/drivers/*.ts, src/pages/BasePage.ts
 */

export type ApiSurface = 'world' | 'web' | 'api' | 'maestro' | 'fx' | 'db' | 'page';

const REFERENCES: Record<ApiSurface, string> = {
  world: `## ConductorWorld

The Cucumber \`World\` subclass that wires all drivers together. Import with:
\`\`\`typescript
import { ConductorWorld } from 'conductor-e2e';
\`\`\`

Activated by tag hooks in \`src/hooks/index.ts\` — loaded via:
\`\`\`js
require.resolve('conductor-e2e/dist/src/hooks/index')
\`\`\`

### Properties

| Property | Type | Description |
|---|---|---|
| \`config\` | \`EnvironmentConfig\` | Resolved environment config (web, api, mobile, database, desktop) |
| \`data\` | \`Record<string, unknown>\` | Shared test data bag — use to pass values between steps |
| \`logger\` | \`pino.Logger\` | Structured logger (writes to stderr) |

### Driver Getters (lazy — instantiate on first access)

| Getter | Type | Description |
|---|---|---|
| \`web\` | \`WebDriver\` | Playwright browser driver. Launches browser on first access (if \`@web\` hook hasn't already). |
| \`page\` | \`Page\` | Shortcut for \`this.web.page\` — the active Playwright \`Page\`. |
| \`api\` | \`ApiDriver\` | Playwright APIRequestContext wrapper. Call \`init()\` before first use. |
| \`request\` | \`APIRequestContext\` | Shortcut for \`this.api.client\`. |
| \`maestro\` | \`MaestroDriver\` | Maestro CLI runner for mobile flows. |
| \`fx\` | \`JavaFxDriver\` | JavaFX desktop driver. Requires \`config.desktop\` to be set. |
| \`db\` | \`DatabaseDriver\` | Database driver — throws unless registered via \`setDb()\`. |

### Methods

| Method | Description |
|---|---|
| \`setDb(driver: DatabaseDriver): void\` | Register a database adapter (call in a \`Before\` hook scoped to \`@database\`). |
| \`closeWeb(): Promise<void>\` | Close the browser (called by the \`@web\` after-hook). |
| \`disposeApi(): Promise<void>\` | Dispose the API request context. |
| \`closeFx(): Promise<void>\` | Close the JavaFX process. |
| \`disconnectDb(): Promise<void>\` | Disconnect the database. |
| \`isFxLaunched\` | \`boolean\` — whether the JavaFX driver has been started. |
| \`hasDb\` | \`boolean\` — whether a database driver is registered. |

### Tag → hook mapping

| Tag | Auto-managed lifecycle |
|---|---|
| \`@web\` | Browser launch + failure screenshot + browser close |
| \`@mobile\` | Logs target Maestro device |
| \`@desktop\` | JavaFX launch + failure screenshot + close |
| \`@database\` | DB connect before, DB disconnect after |
| \`@cross-platform\` | All of the above |
`,

  web: `## WebDriver

Manages the Playwright browser lifecycle. Accessed via \`this.web\` or \`this.page\` on \`ConductorWorld\`.

### Methods

| Method | Signature | Description |
|---|---|---|
| \`launch\` | \`(opts?: WebDriverOptions): Promise<void>\` | Launch the browser. Called automatically by the \`@web\` tag hook. |
| \`close\` | \`(): Promise<void>\` | Close browser, context, and page. |
| \`takeScreenshot\` | \`(name: string): Promise<Buffer>\` | Screenshot the full page; saves to \`reports/screenshots/<name>.png\`. |

### Getters

| Getter | Type | Description |
|---|---|---|
| \`page\` | \`Page\` | The active Playwright \`Page\`. Throws if not launched. |
| \`context\` | \`BrowserContext\` | The browser context. Useful for sharing cookies with ApiDriver. |
| \`browser\` | \`Browser\` | The raw Browser instance. |
| \`isLaunched\` | \`boolean\` | Whether the browser is currently open. |

### Config (EnvironmentConfig.web)

\`\`\`typescript
interface WebConfig {
  baseUrl: string;
  headless: boolean;
  browserName: 'chromium' | 'firefox' | 'webkit';
  slowMo?: number;
  viewport?: { width: number; height: number };
}
\`\`\`

Env var overrides: \`WEB_BASE_URL\`, \`HEADLESS\`, \`BROWSER\`.
`,

  api: `## ApiDriver

Wraps Playwright's \`APIRequestContext\` for REST API testing. Accessed via \`this.api\` or \`this.request\`.

### Methods

| Method | Signature | Description |
|---|---|---|
| \`init\` | \`(context?: BrowserContext): Promise<void>\` | Initialize the API client. Pass \`this.web.context\` to share cookies. |
| \`get\` | \`(url: string, options?): Promise<APIResponse>\` | HTTP GET |
| \`post\` | \`(url: string, data?, options?): Promise<APIResponse>\` | HTTP POST |
| \`put\` | \`(url: string, data?, options?): Promise<APIResponse>\` | HTTP PUT |
| \`delete\` | \`(url: string, options?): Promise<APIResponse>\` | HTTP DELETE |
| \`dispose\` | \`(): Promise<void>\` | Dispose the API context. |

### Getters

| Getter | Type | Description |
|---|---|---|
| \`client\` | \`APIRequestContext\` | Raw Playwright client. Throws if not initialized. |
| \`isInitialized\` | \`boolean\` | Whether \`init()\` has been called. |

### Config (EnvironmentConfig.api)

\`\`\`typescript
interface ApiConfig {
  baseUrl: string;
  defaultCredentials: { username: string; password: string };
  timeoutMs?: number;
}
\`\`\`

Env var override: \`API_BASE_URL\`.

### Usage pattern

\`\`\`typescript
// Pure API test (no @web tag needed)
When('I create a todo {string}', async function (this: ConductorWorld, title: string) {
  if (!this.api.isInitialized) await this.api.init();
  const response = await this.api.post(\`\${this.config.api.baseUrl}/todos\`, { title });
  if (!response.ok()) throw new Error(\`API failed: \${response.status()}\`);
});

// Shared cookies with browser session
if (!this.api.isInitialized) await this.api.init(this.web.context);
\`\`\`
`,

  maestro: `## MaestroDriver

Spawns the Maestro CLI as a child process to run YAML flows. Accessed via \`this.maestro\`.

### Methods

| Method | Signature | Description |
|---|---|---|
| \`run\` | \`(flowName: string, opts?: MaestroRunOptions): Promise<MaestroResult>\` | Run a flow; returns result without throwing. |
| \`runOrThrow\` | \`(flowName: string, opts?: MaestroRunOptions): Promise<MaestroResult>\` | Run a flow; throws on failure. Auto-retries with \`--reinstall-driver\` on gRPC crash. |
| \`takeScreenshot\` | \`(name: string): Promise<string>\` | Capture ADB screenshot; returns path. |

### MaestroRunOptions

\`\`\`typescript
interface MaestroRunOptions {
  env?: Record<string, string>;  // passed as --env KEY=VALUE
  timeoutMs?: number;
  reinstallDriver?: boolean;
}
\`\`\`

### Config (EnvironmentConfig.mobile)

\`\`\`typescript
interface MobileConfig {
  deviceId?: string;
  flowsDir: string;       // directory where YAML flows live (e.g. 'flows/mobile')
  timeoutMs: number;
  maestroBin?: string;    // default 'maestro'
}
\`\`\`

Env var overrides: \`MAESTRO_DEVICE\`, \`DEBUG_MAESTRO\` (set to \`0\` to silence output).

### Flow YAML conventions

\`\`\`yaml
appId: com.example.myapp
---
- launchApp:
    clearState: false
- tapOn: "Submit"
- assertVisible: "Success"
- takeScreenshot: "after-submit"
\`\`\`

Flows live in \`flows/mobile/<name>.yaml\`. Run them as \`runOrThrow('name')\`.

### Variable passing

\`\`\`typescript
await this.maestro.runOrThrow('create-todo', {
  env: { TODO_TITLE: 'Buy groceries' }
});
\`\`\`

In the flow: \`inputText: \${TODO_TITLE}\`
`,

  fx: `## JavaFxDriver (javafx-driver)

Controls a JavaFX desktop application by attaching \`fxagent.jar\`. Accessed via \`this.fx\`.
Activated by the \`@desktop\` tag hook.

### Methods

| Method | Signature | Description |
|---|---|---|
| \`launch\` | \`(opts: LaunchOptions): Promise<void>\` | Start the JavaFX app with the agent JAR. |
| \`locator\` | \`(selector: string): FxLocator\` | Find a widget by CSS-like ID selector (\`#widget-id\`). |
| \`close\` | \`(): Promise<void>\` | Terminate the JavaFX process. |

### LaunchOptions

\`\`\`typescript
interface LaunchOptions {
  app: string;           // Main class (e.g. 'com.example.Launcher')
  classpath: string;     // Path to app JAR
  jvmArgs?: string[];    // Extra JVM arguments
  readyTimeoutMs?: number;
}
\`\`\`

### Config (EnvironmentConfig.desktop)

\`\`\`typescript
interface DesktopConfig {
  agentJar: string;           // Path to fxagent.jar
  javaBin?: string;
  agentPort?: number;
  agentHost?: string;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
  screenshotDir?: string;
  jvmArgs?: string[];
}
\`\`\`

### Making widgets findable

In JavaFX: \`button.setId("my-button");\` — then \`this.fx.locator('#my-button')\`.
`,

  db: `## DatabaseDriver

Abstract base class for database adapters. Users implement their own and register via \`world.setDb()\`.

### Abstract methods (must implement)

| Method | Signature | Description |
|---|---|---|
| \`connect\` | \`(): Promise<void>\` | Establish connection. |
| \`disconnect\` | \`(): Promise<void>\` | Close connection. |
| \`query<T>\` | \`(sql: string, params?: unknown[]): Promise<QueryResult<T>>\` | Execute a parameterized query. |

### Provided methods

| Method | Signature | Description |
|---|---|---|
| \`queryOne<T>\` | \`(sql: string, params?): Promise<T | null>\` | Returns first row or null. |
| \`execute\` | \`(sql: string, params?): Promise<number>\` | Returns affected row count. |

### QueryResult

\`\`\`typescript
interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}
\`\`\`

### Registration pattern

\`\`\`typescript
// In a Before hook scoped to @database
Before({ tags: '@database' }, async function (this: ConductorWorld) {
  this.setDb(new MyDatabaseDriver(process.env.DATABASE_URL!));
});
\`\`\`
`,

  page: `## BasePage

Abstract base class for page objects. Extend this in \`pages/\`.

\`\`\`typescript
import { BasePage } from 'conductor-e2e';
import type { Locator } from 'playwright';

export class LoginPage extends BasePage {
  private readonly emailInput: Locator;

  constructor(...args: ConstructorParameters<typeof BasePage>) {
    super(...args);
    this.emailInput = this.page.locator('[data-testid="email"]');
  }

  async login(email: string, password: string): Promise<void> {
    await this.navigate('/login');
    await this.emailInput.fill(email);
    await this.page.locator('[data-testid="password"]').fill(password);
    await this.page.locator('[data-testid="submit"]').click();
    await this.waitForLoad();
  }
}
\`\`\`

### Constructor

\`\`\`typescript
constructor(page: Page, config: EnvironmentConfig)
\`\`\`

Shorthand spread: \`new LoginPage(this.page, this.config)\`
or \`new LoginPage(...args)\` in subclass constructor.

### Methods

| Method | Signature | Description |
|---|---|---|
| \`navigate\` | \`(path: string): Promise<void>\` | \`page.goto(path)\` — use relative paths; baseURL is set on the context. |
| \`waitForLoad\` | \`(): Promise<void>\` | \`page.waitForLoadState('networkidle')\` |
| \`getTitle\` | \`(): Promise<string>\` | \`page.title()\` |

### Protected properties

| Property | Type | Description |
|---|---|---|
| \`page\` | \`Page\` | The active Playwright page. |
| \`config\` | \`EnvironmentConfig\` | The environment config. |
`,
};

/**
 * Returns the API reference markdown for the requested surface,
 * or all surfaces concatenated if no filter is specified.
 */
export function getApiReference(surface?: ApiSurface): string {
  if (surface) {
    return REFERENCES[surface];
  }
  return Object.values(REFERENCES).join('\n\n---\n\n');
}

export const ALL_SURFACES: readonly ApiSurface[] = [
  'world',
  'web',
  'api',
  'maestro',
  'fx',
  'db',
  'page',
];
