/**
 * Hand-maintained API reference for conductor-e2e public surface.
 *
 * Keyed by surface name. Each entry is a markdown string with property/method
 * signatures and one-line descriptions. Update this file when the framework API changes.
 *
 * Source of truth: src/world/ConductorWorld.ts, src/drivers/*.ts, src/pages/BasePage.ts
 */

export type ApiSurface = 'world' | 'web' | 'api' | 'maestro' | 'flutter' | 'fx' | 'db' | 'page';

const REFERENCES: Record<ApiSurface, string> = {
  world: `## ConductorWorld

The Cucumber \`World\` subclass that wires all drivers together. Import with:
\`\`\`typescript
import { ConductorWorld } from '@nouhouari/conductor-e2e';
\`\`\`

Activated by tag hooks in \`src/hooks/index.ts\` — loaded via:
\`\`\`js
require.resolve('@nouhouari/conductor-e2e/dist/src/hooks/index')
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
| \`flutterDesktop\` | \`FlutterDesktopDriver\` | Flutter macOS desktop driver. Requires \`config.flutterDesktop\` to be set. |
| \`isFlutterDesktopLaunched\` | \`boolean\` | Whether the Flutter desktop app is currently running. |
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
| \`@flutter-desktop\` | Failure screenshot + Flutter desktop driver close |
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

  flutter: `## FlutterDesktopDriver

Drives a Flutter macOS desktop app (built with \`enableFlutterDriverExtension()\`) by
spawning the executable, reading the Dart VM service URL, and sending \`ext.flutter.driver\`
JSON-RPC commands over WebSocket. Accessed via \`this.flutterDesktop\` on \`ConductorWorld\`.
Activated by the \`@flutter-desktop\` tag hook.

### Finders

\`\`\`typescript
import type { Finder } from '@nouhouari/conductor-e2e';

const byKey  = (key: string): Finder => ({ type: 'ByValueKey', value: key });
const byText = (text: string): Finder => ({ type: 'ByText', value: text });
const byType = (type: string): Finder => ({ type: 'ByType', value: type });
const byTip  = (msg: string): Finder  => ({ type: 'ByTooltipMessage', value: msg });
\`\`\`

Finder types: \`'ByValueKey'\` (widget key), \`'ByText'\` (Text widget content),
\`'ByType'\` (Dart class name), \`'ByTooltipMessage'\`.

### Lifecycle

| Method | Signature | Description |
|---|---|---|
| \`launch\` | \`(): Promise<void>\` | Spawn the app and connect to the Dart VM service. Use for macOS/Windows/Linux desktop. |
| \`connect\` | \`(vmServiceUrl: string, timeoutMs?): Promise<void>\` | Connect to an already-running Flutter app via its VM service URL. Use for mobile (after \`adb forward\` / \`iproxy\`) or externally-managed desktop processes. Accepts HTTP (\`http://localhost:PORT/TOKEN/\`) or WS form. |
| \`close\` | \`(): Promise<void>\` | Close the WebSocket and terminate the spawned process (if any). |
| \`isLaunched\` | \`boolean\` | Whether the driver is currently connected (true after \`launch()\` or \`connect()\`). |

### Gesture & interaction methods

All action methods accept an optional \`timeoutMs\` (default: \`config.flutterDesktop.defaultTimeoutMs ?? 10_000\`).

| Method | Signature | Description |
|---|---|---|
| \`tap\` | \`(finder, timeoutMs?)\` | Tap a widget. |
| \`doubleTap\` | \`(finder, timeoutMs?)\` | Double-tap a widget. |
| \`longPress\` | \`(finder, timeoutMs?)\` | Long-press a widget. |
| \`enterText\` | \`(finder, text, timeoutMs?)\` | Focus \`finder\` and type \`text\` (replaces current value). |
| \`clearText\` | \`(finder, timeoutMs?)\` | Clear a text field (focus + set empty string). |
| \`scroll\` | \`(finder, dx, dy, durationMs?, frequency?, timeoutMs?)\` | Scroll a \`Scrollable\` widget by \`dx\`/\`dy\` pixels over \`durationMs\` ms. |
| \`scrollIntoView\` | \`(finder, alignment?, timeoutMs?)\` | Scroll until \`finder\` is visible. \`alignment\`: 0.0 = top, 0.5 = center, 1.0 = bottom. |

### Query methods

| Method | Signature | Description |
|---|---|---|
| \`getText\` | \`(finder, timeoutMs?) → Promise<string>\` | Read the text of a \`Text\` widget. |
| \`getOffset\` | \`(finder, offsetType?, timeoutMs?) → Promise<Offset>\` | Get screen coordinates. \`offsetType\`: \`'topLeft' \\| 'topRight' \\| 'bottomLeft' \\| 'bottomRight' \\| 'center'\` (default \`'center'\`). |
| \`isVisible\` | \`(finder, timeoutMs?) → Promise<boolean>\` | Non-throwing probe — returns \`true\`/\`false\` (default probe timeout 500 ms). |

### Wait methods

| Method | Signature | Description |
|---|---|---|
| \`waitFor\` | \`(finder, timeoutMs?)\` | Wait until widget exists. Throws on timeout. |
| \`waitForAbsent\` | \`(finder, timeoutMs?)\` | Wait until widget disappears. Throws on timeout. |
| \`waitForCondition\` | \`(condition, timeoutMs?)\` | Wait for app-level condition: \`'NoPendingFrames'\` \\| \`'NoTransientCallbacks'\` \\| \`'FirstFrameRasterized'\`. Equivalent to \`page.waitForLoadState()\`. |

### Advanced

| Method | Signature | Description |
|---|---|---|
| \`requestData\` | \`(message, timeoutMs?) → Promise<string>\` | Send a JSON message to the app's \`enableFlutterDriverExtension\` data handler and return its response. Primary mechanism for app-side actions inside \`Scrollable\` lists (where \`hitTestable()\` never resolves). |
| \`setFrameSync\` | \`(enabled, timeoutMs?)\` | Disable/re-enable Flutter frame sync. Set \`false\` before heavy animations; restore with \`true\`. |
| \`takeScreenshot\` | \`(name) → Promise<string>\` | Capture the Flutter render surface as PNG; returns the file path. |

### Config (EnvironmentConfig.flutterDesktop)

\`\`\`typescript
interface FlutterDesktopConfig {
  appPath: string;            // Absolute path to .app bundle (macOS)
  defaultTimeoutMs?: number;  // Per-action timeout (default 10_000 ms)
  launchTimeoutMs?: number;   // VM service wait timeout (default 30_000 ms)
  vmServicePort?: number;     // Fixed VM service port (optional)
  extraArgs?: string[];       // Extra CLI args
  env?: Record<string, string>;
  screenshotDir?: string;     // Default 'reports/screenshots'
}
\`\`\`

### requestData pattern

Use this instead of gesture-based actions for widgets inside a \`ListView\` or other
\`Scrollable\` — \`hitTestable()\` never resolves for such widgets on macOS desktop.

\`\`\`typescript
// App-side (main_test.dart):
enableFlutterDriverExtension(handler: (message) async {
  final data = json.decode(message!);
  if (data['action'] == 'toggleTodo') { ... return 'ok'; }
});

// Test-side:
await this.flutterDesktop.requestData(JSON.stringify({ action: 'toggleTodo', title }));
\`\`\`

### isEnabled

Not part of the \`ext.flutter.driver\` protocol. Use \`requestData()\` with an app-side
handler that inspects widget state and returns the result as a string.
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
import { BasePage } from '@nouhouari/conductor-e2e';
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

const JAVA_REFERENCES: Record<ApiSurface, string> = {
  world: "## ConductorWorld (Java)\n\nA plain scenario-scoped object injected into Cucumber-JVM step and hook classes by PicoContainer. Import with:\n```java\nimport com.nouhouari.conductor.world.ConductorWorld;\n```\n\nJava step definitions are annotated methods on a class with constructor injection \u2014 not top-level `Given(...)` calls:\n```java\npublic class WebSteps {\n    private final ConductorWorld world;\n\n    public WebSteps(ConductorWorld world) {\n        this.world = world;\n    }\n\n    @When(\"I create a todo titled {string}\")\n    public void iCreateATodoTitled(String title) {\n        new TodoPage(world.page(), world.config).createTodo(title);\n        world.data.put(\"lastTodoTitle\", title);\n    }\n}\n```\n\n### Fields\n\n| Field | Type | Description |\n|---|---|---|\n| `config` | `EnvironmentConfig` | Resolved YAML config from `ConfigLoader.get()` |\n| `data` | `Map<String, Object>` | Shared scenario data bag \u2014 use to pass values between steps |\n| `logger` | `org.slf4j.Logger` | Structured logger named `conductor` |\n| `scenario` | `io.cucumber.java.Scenario` | Captured by `ScenarioContextHooks`; use for `scenario.attach(...)` in steps |\n\n### Driver accessors (lazy \u2014 instantiate on first access)\n\n| Method | Return type | Description |\n|---|---|---|\n| `web()` | `WebDriver` | Playwright browser driver. |\n| `page()` | `Page` | Shortcut for `world.web().getPage()`. |\n| `api()` | `ApiDriver` | Playwright APIRequestContext wrapper. Call `init()` before first use. |\n| `request()` | `APIRequestContext` | Shortcut for `world.api().getClient()`. |\n| `maestro()` | `MaestroDriver` | Maestro CLI runner for mobile flows. |\n| `flutterDesktop()` | `FlutterDesktopDriver` | Flutter desktop driver; requires `config.flutterDesktop()` to be present. |\n| `isFlutterDesktopLaunched()` | `boolean` | Whether the Flutter desktop driver is connected. |\n| `fx()` | `JavaFxDriver` | JavaFX desktop driver; requires `config.desktop()` to be present. |\n| `isFxLaunched()` | `boolean` | Whether the JavaFX app is currently launched. |\n| `db()` | `DatabaseDriver` | Database adapter \u2014 throws unless registered via `setDb()`. |\n| `hasDb()` | `boolean` | Whether a database driver is registered. |\n\n### Lifecycle methods\n\n| Method | Description |\n|---|---|\n| `setDb(DatabaseDriver driver): void` | Register a database adapter (typically from a hook scoped to `@database`). |\n| `closeWeb(): void` | Close browser, context, and page. |\n| `disposeApi(): void` | Dispose the API request context. |\n| `closeFx(): void` | Close the JavaFX process. |\n| `closeFlutterDesktop(): void` | Close the Flutter desktop connection/process. |\n| `disconnectDb(): void` | Disconnect and unregister the database driver. |\n\n### Tag \u2192 hook mapping\n\nHooks live in `com.nouhouari.conductor.hooks` and are included through the suite `GLUE_PROPERTY_NAME`.\n\n| Tag | Auto-managed lifecycle |\n|---|---|\n| `@web` | Browser launch + failure screenshot + browser close |\n| `@mobile` | Logs target Maestro device |\n| `@flutter-desktop` | Logs availability + failure screenshot + close |\n| `@desktop` | Logs availability + failure screenshot + close |\n| `@database` | DB connect if registered + DB disconnect |\n| `@cross-platform` | All matching platform hooks |\n\n### JUnit Platform suite pattern\n\nSuites are the Java equivalent of `cucumber.js` profiles:\n```java\n@Suite\n@IncludeEngines(\"cucumber\")\n@ConfigurationParameter(key = GLUE_PROPERTY_NAME,\n        value = \"com.nouhouari.conductor.hooks,com.nouhouari.conductor.example.stepdefs\")\n@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, value = \"../../example/features/web\")\n@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = \"@web\")\n@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,\n        value = \"pretty, io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm, json:target/cucumber-report.json\")\npublic class WebSuiteTest {\n}\n```\n\nRun a tagged suite with Maven:\n```bash\ncd java\nmvn -pl conductor-example -am test -Dtest=WebSuiteTest\n```\n",
  web: "## WebDriver (Java)\n\nManages the Playwright Java browser lifecycle. Accessed via `world.web()` or `world.page()` on `ConductorWorld`.\n\n```java\nimport com.nouhouari.conductor.drivers.WebDriver;\nimport com.microsoft.playwright.Page;\n```\n\n### Methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `launch` | `void launch()` | Launch using `world.config.web()` defaults. Called by the `@web` hook. |\n| `launch` | `void launch(Boolean headlessOverride, Integer slowMoOverride)` | Launch with optional headless/slowMo overrides. |\n| `close` | `void close()` | Close page, context, and browser. |\n| `takeScreenshot` | `byte[] takeScreenshot(String name)` | Full-page screenshot saved to `reports/screenshots/<name>.png`; returns PNG bytes. |\n| `getPage` | `Page getPage()` | Active Playwright `Page`; throws if not launched. |\n| `getContext` | `BrowserContext getContext()` | Active browser context; useful for sharing cookies with `ApiDriver`. |\n| `getBrowser` | `Browser getBrowser()` | Raw Playwright browser; throws if not launched. |\n| `isLaunched` | `boolean isLaunched()` | Whether the browser is currently open. |\n\n### Config (`EnvironmentConfig.web()`)\n\n```java\npublic record WebConfig(\n        String baseUrl,\n        boolean headless,\n        String browserName,\n        Integer slowMo,\n        Viewport viewport) {\n}\n```\n\n`browserName` is one of `\"chromium\"`, `\"firefox\"`, or `\"webkit\"`. Env var overrides include `WEB_BASE_URL`, `HEADLESS`, and `BROWSER`.\n\n### Usage pattern\n\n```java\n@Given(\"I am on the todo web application\")\npublic void iAmOnTheTodoWebApplication() {\n    world.page().navigate(world.config.web().baseUrl());\n}\n\n@When(\"I log in as {string} with password {string}\")\npublic void iLogInAsWithPassword(String username, String password) {\n    new LoginPage(world.page(), world.config).login(username, password);\n}\n```\n",
  api: "## ApiDriver (Java)\n\nWraps Playwright Java's `APIRequestContext` for REST API testing. Accessed via `world.api()` or `world.request()`.\n\n```java\nimport com.microsoft.playwright.APIResponse;\nimport com.nouhouari.conductor.drivers.ApiDriver;\n```\n\n### Methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `init` | `void init()` | Create a new API request context with `config.api().baseUrl()`. |\n| `init` | `void init(BrowserContext context)` | Reuse a browser context's request context to share cookies. |\n| `getClient` | `APIRequestContext getClient()` | Raw Playwright client; throws if not initialized. |\n| `isInitialized` | `boolean isInitialized()` | Whether `init()` has been called. |\n| `get` | `APIResponse get(String url)` | HTTP GET. |\n| `post` | `APIResponse post(String url, Object data)` | HTTP POST with JSON data. |\n| `put` | `APIResponse put(String url, Object data)` | HTTP PUT with JSON data. |\n| `delete` | `APIResponse delete(String url)` | HTTP DELETE. |\n| `json` | `<T> T json(APIResponse response, Class<T> type)` | Deserialize response body with Jackson. |\n| `jsonList` | `<T> List<T> jsonList(APIResponse response, Class<T> elementType)` | Deserialize response body as `List<T>`. |\n| `dispose` | `void dispose()` | Dispose the API context. |\n\n### Config (`EnvironmentConfig.api()`)\n\n```java\npublic record ApiConfig(\n        String baseUrl,\n        Credentials defaultCredentials,\n        Integer timeoutMs) {\n}\n```\n\nEnv var override: `API_BASE_URL`.\n\n### Usage pattern\n\n```java\nprivate String todosUrl() {\n    return world.config.api().baseUrl() + \"/api/todos\";\n}\n\n@When(\"I create a todo {string} via the API\")\npublic void iCreateATodoViaTheApi(String title) {\n    if (!world.api().isInitialized()) {\n        world.api().init();\n    }\n    APIResponse response = world.api().post(todosUrl(), Map.of(\"title\", title, \"status\", \"open\"));\n    if (!response.ok()) {\n        throw new RuntimeException(\"Failed to create todo: \" + response.status() + \" \" + response.statusText());\n    }\n    TodoResponse todo = world.api().json(response, TodoResponse.class);\n    world.data.put(\"lastTodoId\", todo.id());\n}\n```\n",
  maestro: "## MaestroDriver (Java)\n\nSpawns the Maestro CLI as a child process to run YAML flows. Accessed via `world.maestro()`.\n\n```java\nimport com.nouhouari.conductor.drivers.MaestroDriver;\n```\n\n### Methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `run` | `Result run(String flowName)` | Run `flowsDir/<flowName>.yaml`; returns result without throwing. |\n| `run` | `Result run(String flowName, Map<String, String> env)` | Run with `--env KEY=VALUE` variables. |\n| `run` | `Result run(String flowName, Map<String, String> env, Long timeoutOverrideMs, boolean reinstallDriver)` | Full control over timeout and `--reinstall-driver`. |\n| `runOrThrow` | `Result runOrThrow(String flowName)` | Run a flow and throw on failure. Auto-retries after known gRPC driver crash. |\n| `runOrThrow` | `Result runOrThrow(String flowName, Map<String, String> env)` | Run with env variables and throw on failure. |\n| `takeScreenshot` | `byte[] takeScreenshot(String name)` | Capture `adb exec-out screencap -p`, save to `reports/screenshots/<name>.png`, and return PNG bytes. |\n\n### Result\n\n```java\npublic record Result(boolean success, String output, int exitCode) {\n}\n```\n\n### Config (`EnvironmentConfig.mobile()`)\n\n```java\npublic record MobileConfig(\n        String deviceId,\n        String flowsDir,\n        int timeoutMs,\n        String maestroBin) {\n}\n```\n\nEnv var overrides: `MAESTRO_DEVICE`, `DEBUG_MAESTRO` (set to `0` or `false` to silence streamed output).\n\n### Flow YAML conventions\n\n```yaml\nappId: com.example.myapp\n---\n- launchApp:\n    clearState: false\n- tapOn: \"Submit\"\n- assertVisible: \"Success\"\n```\n\nFlows live under `world.config.mobile().flowsDir()` and are invoked without the `.yaml` suffix.\n\n### Variable passing\n\n```java\nworld.maestro().runOrThrow(\"create-todo\", Map.of(\"TODO_TITLE\", title));\n\nMaestroDriver.Result result = world.maestro().run(\"verify-todo\", Map.of(\"TODO_TITLE\", title));\nif (result.success()) {\n    throw new AssertionError(\"Todo should not be visible on mobile\");\n}\n```\n",
  flutter: "## FlutterDesktopDriver (Java)\n\nDrives a Flutter desktop app built with `enableFlutterDriverExtension()` by spawning the executable or connecting to an existing Dart VM service, then issuing `ext.flutter.driver` JSON-RPC commands over a JDK `WebSocket`. Accessed via `world.flutterDesktop()`.\n\n```java\nimport com.nouhouari.conductor.drivers.FlutterDesktopDriver;\nimport com.nouhouari.conductor.drivers.FlutterDesktopDriver.Finder;\nimport com.nouhouari.conductor.drivers.FlutterDesktopDriver.FinderType;\n```\n\n### Finders and value types\n\n```java\npublic enum FinderType { ByValueKey, ByText, ByType, ByTooltipMessage }\npublic record Finder(FinderType type, String value) {\n}\npublic enum OffsetType { topLeft, topRight, bottomLeft, bottomRight, center }\npublic record Offset(double dx, double dy) {\n}\npublic enum WaitCondition { NoPendingFrames, NoTransientCallbacks, FirstFrameRasterized }\n```\n\nExample helpers from the Java example:\n```java\nprivate static Finder byText(String text) {\n    return new Finder(FinderType.ByText, text);\n}\n\nprivate static Finder byKey(String key) {\n    return new Finder(FinderType.ByValueKey, key);\n}\n```\n\n### Lifecycle\n\n| Method | Signature | Description |\n|---|---|---|\n| `launch` | `void launch()` | Spawn `config.flutterDesktop().appPath()` and connect to the Dart VM service. |\n| `connect` | `void connect(String vmServiceUrl)` | Connect to an already-running app. Accepts HTTP or WS VM service URL. |\n| `connect` | `void connect(String vmServiceUrl, int timeoutMs)` | Connect with custom extension registration timeout. |\n| `close` | `void close()` | Abort the WebSocket and terminate the spawned process, if any. |\n| `isLaunched` | `boolean isLaunched()` | Whether the driver is connected and has an isolate id. |\n\n### Gesture & interaction methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `tap` | `void tap(Finder finder)` / `void tap(Finder finder, Integer timeoutMs)` | Tap a widget. |\n| `doubleTap` | `void doubleTap(Finder finder)` / `void doubleTap(Finder finder, Integer timeoutMs)` | Double-tap a widget. |\n| `longPress` | `void longPress(Finder finder)` / `void longPress(Finder finder, Integer timeoutMs)` | Long-press a widget. |\n| `enterText` | `void enterText(Finder finder, String text)` / `void enterText(Finder finder, String text, Integer timeoutMs)` | Enable text-entry emulation, tap, then enter text. |\n| `clearText` | `void clearText(Finder finder)` / `void clearText(Finder finder, Integer timeoutMs)` | Enable text-entry emulation, tap, then enter an empty string. |\n| `scroll` | `void scroll(Finder finder, double dx, double dy)` | Scroll with default duration/frequency. |\n| `scroll` | `void scroll(Finder finder, double dx, double dy, Integer durationMs, Integer frequency, Integer timeoutMs)` | Scroll a `Scrollable` widget. |\n| `scrollIntoView` | `void scrollIntoView(Finder finder)` / `void scrollIntoView(Finder finder, Double alignment, Integer timeoutMs)` | Scroll until the finder is visible. |\n\n### Query and wait methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `getText` | `String getText(Finder finder)` / `String getText(Finder finder, Integer timeoutMs)` | Read the text of a `Text` widget. |\n| `getOffset` | `Offset getOffset(Finder finder)` / `Offset getOffset(Finder finder, OffsetType offsetType, Integer timeoutMs)` | Get screen coordinates. |\n| `isVisible` | `boolean isVisible(Finder finder)` / `boolean isVisible(Finder finder, Integer timeoutMs)` | Non-throwing probe. Default probe timeout is 2000 ms. |\n| `waitFor` | `void waitFor(Finder finder)` / `void waitFor(Finder finder, Integer timeoutMs)` | Wait until widget exists. |\n| `waitForAbsent` | `void waitForAbsent(Finder finder)` / `void waitForAbsent(Finder finder, Integer timeoutMs)` | Wait until widget disappears. |\n| `waitForCondition` | `void waitForCondition(WaitCondition condition)` | Wait for a built-in condition. |\n| `waitForCondition` | `void waitForCondition(String conditionName)` / `void waitForCondition(String conditionName, Integer timeoutMs)` | Wait for a named condition. |\n\n### Advanced\n\n| Method | Signature | Description |\n|---|---|---|\n| `requestData` | `String requestData(String message)` / `String requestData(String message, Integer timeoutMs)` | Send a JSON message to the app's driver-extension data handler. |\n| `setFrameSync` | `void setFrameSync(boolean enabled)` / `void setFrameSync(boolean enabled, Integer timeoutMs)` | Disable/re-enable Flutter frame sync. |\n| `takeScreenshot` | `String takeScreenshot(String name)` | Capture PNG, write to configured screenshot dir, and return the file path. |\n\n### Config (`EnvironmentConfig.flutterDesktop()`)\n\n```java\npublic record FlutterDesktopConfig(\n        String appPath,\n        Integer defaultTimeoutMs,\n        Integer launchTimeoutMs,\n        Integer vmServicePort,\n        List<String> extraArgs,\n        Map<String, String> env,\n        String screenshotDir) {\n}\n```\n\nEnv var overrides: `FLUTTER_DESKTOP_APP_PATH`, `FLUTTER_DESKTOP_VM_PORT`.\n\n### requestData pattern\n\nUse `requestData()` for app-side actions in lists/scrollables when gesture hit testing is unreliable on macOS desktop:\n```java\nString resp = world.flutterDesktop().requestData(\n        \"{\\\"action\\\":\\\"toggleTodo\\\",\\\"title\\\":\\\"\" + escape(title) + \"\\\"}\", 15000);\nif (resp.startsWith(\"error:\")) {\n    throw new RuntimeException(\"toggleTodo failed: \" + resp);\n}\n```\n",
  fx: "## JavaFxDriver (Java)\n\nControls a JavaFX desktop application instrumented with `fxagent.jar` via `-javaagent:` and the agent's HTTP/JSON protocol. Accessed via `world.fx()` and auto-closed by the `@desktop` hook.\n\n```java\nimport com.nouhouari.conductor.drivers.JavaFxDriver;\n```\n\n### Driver methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `launch` | `void launch(LaunchOptions opts)` | Start the JavaFX app with configured `agentJar`. |\n| `locator` | `Locator locator(String selector)` | Create a locator for selectors such as `#todo-input`, `text=OK`, or `css=.dialog-pane .text-input`. |\n| `screenshot` | `byte[] screenshot(String name)` | Capture a screenshot, save to configured dir or `reports/screenshots`, and return PNG bytes. |\n| `close` | `void close()` | Terminate the JavaFX process. |\n| `isLaunched` | `boolean isLaunched()` | Whether launch completed and the agent is ready. |\n\n### Records\n\n```java\npublic record LaunchOptions(String app, String classpath, List<String> jvmArgs, Integer readyTimeoutMs) {\n}\n\npublic record WaitOptions(String state, Integer timeoutMs) {\n}\n```\n\n### Locator methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `click` | `void click()` | Perform a click action. |\n| `fill` | `void fill(String value)` | Clear then fill a text field. |\n| `selectOption` | `void selectOption(String value)` | Select an option. |\n| `setText` | `void setText(String value)` | Set text directly. |\n| `waitFor` | `void waitFor(WaitOptions opts)` | Poll until state matches. States: `visible`, `hidden`, `disabled`, `enabled`, `attached`. |\n\n### Config (`EnvironmentConfig.desktop()`)\n\n```java\npublic record DesktopConfig(\n        String agentJar,\n        String javaBin,\n        Integer agentPort,\n        String agentHost,\n        Integer defaultTimeoutMs,\n        Integer pollIntervalMs,\n        String screenshotDir,\n        List<String> jvmArgs) {\n}\n```\n\n### Usage pattern\n\n```java\n@Given(\"the desktop app is running\")\npublic void theDesktopAppIsRunning() {\n    String jarPath = Paths.get(\"../../apps/desktop/build/libs/todoapp-desktop-all.jar\")\n            .toAbsolutePath().normalize().toString();\n    world.fx().launch(new JavaFxDriver.LaunchOptions(\n            \"com.example.todoapp.Launcher\",\n            jarPath,\n            List.of(\"-DAPI_BASE_URL=\" + world.config.api().baseUrl()),\n            30000));\n    world.fx().locator(\"#todo-input\").waitFor(new JavaFxDriver.WaitOptions(\"visible\", 15000));\n}\n\nworld.fx().locator(\"#todo-input\").fill(title);\nworld.fx().locator(\"#todo-priority-select\").selectOption(priority);\nworld.fx().locator(\"#todo-add\").click();\nworld.fx().locator(\"text=\" + title).waitFor(new JavaFxDriver.WaitOptions(\"visible\", null));\n```\n\nMake widgets findable in JavaFX with ids such as `button.setId(\"todo-add\")`, then query `#todo-add`.\n",
  db: "## DatabaseDriver (Java)\n\nAbstract base class for database adapters. Consumers subclass it and register an instance with `world.setDb(...)`.\n\n```java\nimport com.nouhouari.conductor.drivers.DatabaseDriver;\n```\n\n### Abstract methods (must implement)\n\n| Method | Signature | Description |\n|---|---|---|\n| `connect` | `public abstract void connect()` | Establish a connection. |\n| `disconnect` | `public abstract void disconnect()` | Close the connection. |\n| `query` | `public abstract <T> QueryResult<T> query(String sql, Object... params)` | Execute a parameterized query. |\n\n### Provided methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `queryOne` | `public <T> Optional<T> queryOne(String sql, Object... params)` | Return the first row as `Optional<T>`. |\n| `execute` | `public int execute(String sql, Object... params)` | Return affected row count from `query(...).rowCount()`. |\n\n### QueryResult\n\n```java\npublic record QueryResult<T>(List<T> rows, int rowCount) {\n}\n```\n\n### Config (`EnvironmentConfig.database()`)\n\n```java\npublic record DatabaseConfig(boolean enabled) {\n}\n```\n\n### Registration pattern\n\n```java\npublic class TestDatabaseHooks {\n    private final ConductorWorld world;\n\n    public TestDatabaseHooks(ConductorWorld world) {\n        this.world = world;\n    }\n\n    @Before(\"@database\")\n    public void registerDb() {\n        world.setDb(new MyDatabaseDriver(System.getenv(\"DATABASE_URL\")));\n    }\n}\n```\n\nThe built-in `DatabaseHooks` calls `world.db().connect()` only when `world.hasDb()` is true, then calls `world.disconnectDb()` after `@database` or `@cross-platform` scenarios.\n",
  page: "## BasePage (Java)\n\nAbstract base class for Playwright page objects. Extend this in Java page classes.\n\n```java\nimport com.microsoft.playwright.Locator;\nimport com.microsoft.playwright.Page;\nimport com.nouhouari.conductor.config.EnvironmentConfig;\nimport com.nouhouari.conductor.pages.BasePage;\n\npublic class LoginPage extends BasePage {\n    private final Locator usernameInput;\n    private final Locator passwordInput;\n    private final Locator submitButton;\n\n    public LoginPage(Page page, EnvironmentConfig config) {\n        super(page, config);\n        this.usernameInput = page.locator(\"[data-testid=\"username\"]\");\n        this.passwordInput = page.locator(\"[data-testid=\"password\"]\");\n        this.submitButton = page.locator(\"[data-testid=\"login-submit\"]\");\n    }\n\n    public void login(String username, String password) {\n        navigate(\"/login\");\n        usernameInput.fill(username);\n        passwordInput.fill(password);\n        submitButton.click();\n        waitForLoad();\n    }\n}\n```\n\n### Constructor\n\n```java\nprotected BasePage(Page page, EnvironmentConfig config)\n```\n\nConcrete page objects expose public constructors and pass `world.page()` / `world.config`:\n```java\nnew TodoPage(world.page(), world.config).createTodo(title);\n```\n\n### Methods\n\n| Method | Signature | Description |\n|---|---|---|\n| `navigate` | `public void navigate(String path)` | Calls `page.navigate(path)`. |\n| `waitForLoad` | `public void waitForLoad()` | Calls `page.waitForLoadState(LoadState.NETWORKIDLE)`. |\n| `getTitle` | `public String getTitle()` | Returns `page.title()`. |\n\n### Protected fields\n\n| Field | Type | Description |\n|---|---|---|\n| `page` | `Page` | The active Playwright page. |\n| `config` | `EnvironmentConfig` | The resolved Java config record. |\n\n### Config source\n\nJava config is YAML on the classpath, not TypeScript `config/environments/*.ts` files. `ConfigLoader` merges `config/default.yml`, optional `config/local-overrides.yml`, and optional `config/${TEST_ENV}.yml`, then applies env var overrides.\n",
};

/**
 * Returns the API reference markdown for the requested surface,
 * or all surfaces concatenated if no filter is specified.
 */
export function getApiReference(
  surface?: ApiSurface,
  language: 'typescript' | 'java' = 'typescript',
): string {
  const references = language === 'java' ? JAVA_REFERENCES : REFERENCES;
  if (surface) {
    return references[surface];
  }
  return Object.values(references).join('\n\n---\n\n');
}

export const ALL_SURFACES: readonly ApiSurface[] = [
  'world',
  'web',
  'api',
  'maestro',
  'flutter',
  'fx',
  'db',
  'page',
];
