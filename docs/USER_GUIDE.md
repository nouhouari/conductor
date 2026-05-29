# Conductor — User Guide

This guide walks you through creating an **E2E test project from scratch** using Conductor. By the end, you'll have a project that drives a web app, a REST API, and (optionally) a Flutter mobile app and a JavaFX desktop app from one Cucumber scenario.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Bootstrap a new project](#2-bootstrap-a-new-project)
3. [Project layout](#3-project-layout)
4. [Configure environments](#4-configure-environments)
5. [Hooks: how scenario tags wire up drivers](#5-hooks-how-scenario-tags-wire-up-drivers)
6. [Write your first web feature](#6-write-your-first-web-feature)
7. [Add API scenarios](#7-add-api-scenarios)
8. [Add mobile scenarios (Flutter + Maestro)](#8-add-mobile-scenarios-flutter--maestro)
9. [Add desktop scenarios (JavaFX)](#9-add-desktop-scenarios-javafx)
10. [Bring your own database](#10-bring-your-own-database)
11. [Cross-platform scenarios](#11-cross-platform-scenarios)
12. [Running tests](#12-running-tests)
13. [Allure reporting](#13-allure-reporting)
14. [CI/CD](#14-cicd)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Prerequisites

| Required for | Tool | How to install |
|---|---|---|
| Always | Node.js ≥ 18 | [nodejs.org](https://nodejs.org) |
| Web tests | Playwright browsers | `npx playwright install` |
| Mobile tests | Maestro CLI + Java 17+ | `curl -fsSL https://get.maestro.mobile.dev \| bash` |
| Mobile tests | Android SDK + device/emulator | Android Studio or `sdkmanager` |
| Desktop tests | Java 21+ | `brew install openjdk@21` (macOS) |
| Reports | Allure CLI | bundled via `allure-commandline` |
| Database (optional) | Whatever your app uses | — |

Conductor itself only requires Node ≥ 18. The other tools are needed only if you use the matching driver.

---

## 2. Bootstrap a new project

```bash
mkdir my-e2e && cd my-e2e
npm init -y
npm install conductor @cucumber/cucumber ts-node tsconfig-paths typescript @types/node
npm install --save-dev allure-cucumberjs allure-commandline
npx playwright install chromium
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": "."
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `cucumber.js`:

```js
const path = require('path');

// Loading framework hooks by direct path ensures we share the same
// @cucumber/cucumber instance as the runner — required for World hooks.
const conductorHooks = require.resolve('conductor/dist/src/hooks/index');

module.exports = {
  default: {
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    require: [conductorHooks, 'step-definitions/**/*.ts'],
    format: [
      'progress-bar',
      'allure-cucumberjs/reporter',
      'json:reports/cucumber-report.json'
    ],
    formatOptions: { snippetInterface: 'async-await' },
    paths: ['features/**/*.feature']
  }
};
```

Create the directories:

```bash
mkdir -p features/web features/api step-definitions pages reports
```

---

## 3. Project layout

A typical Conductor consumer project looks like this:

```
my-e2e/
├── package.json
├── tsconfig.json
├── cucumber.js                Cucumber profiles + framework hooks wiring
├── conductor.config.ts        Your env config (optional)
├── features/                  Gherkin .feature files, grouped by platform
│   ├── web/
│   ├── api/
│   ├── mobile/
│   ├── desktop/
│   └── cross-platform/
├── step-definitions/          TypeScript step definitions
│   ├── web.steps.ts
│   ├── api.steps.ts
│   └── mobile.steps.ts
├── pages/                     Page objects (extend BasePage)
│   ├── LoginPage.ts
│   └── DashboardPage.ts
├── flows/                     Maestro YAML flows (if testing mobile)
│   └── mobile/
└── reports/                   Cucumber JSON output + Allure source
```

The `example/` directory in the conductor repo is a working reference of this exact layout — copy it as a starting point if you prefer.

---

## 4. Configure environments

Conductor ships a default config (`http://localhost:3000`, Playwright Chromium headless). To customize, create `conductor.config.ts` and override:

```typescript
import type { EnvironmentConfig } from 'conductor';

export const config: Partial<EnvironmentConfig> = {
  web: {
    baseUrl: 'http://localhost:8080',
    headless: false,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 }
  },
  api: {
    baseUrl: 'http://localhost:8080/api',
    defaultCredentials: { username: 'admin', password: 'admin' },
    timeoutMs: 30000
  },
  mobile: {
    flowsDir: 'flows/mobile',
    timeoutMs: 120000
  }
};
```

**Environment variable overrides** (no rebuild needed):

| Var | Effect |
|---|---|
| `TEST_ENV` | Picks `config/environments/<name>.ts` |
| `WEB_BASE_URL` | Overrides web base URL |
| `API_BASE_URL` | Overrides API base URL |
| `HEADLESS` | `true` / `false` |
| `BROWSER` | `chromium` / `firefox` / `webkit` |
| `MAESTRO_DEVICE` | Target device/emulator ID |
| `DEBUG_MAESTRO` | Set to `0` to silence live Maestro output |

---

## 5. Hooks: how scenario tags wire up drivers

Conductor registers Before/After hooks that activate automatically based on **scenario tags**:

| Tag | What happens |
|---|---|
| `@web` | Browser launches before scenario; failure screenshot attached; browser closes after |
| `@mobile` | Logs target Maestro device |
| `@desktop` | JavaFX app launches via agent JAR; failure screenshot; app closes |
| `@database` | DB driver connects before, disconnects after |
| `@cross-platform` | All of the above |
| no tag | Nothing auto-managed — you control everything |

Drivers are also **lazily instantiated** on first access:

```typescript
this.web    // ← launches the browser (if not already launched)
this.page   // ← active Page on the WebDriver
this.api    // ← shares cookies with WebDriver if both are active
this.maestro
this.fx     // ← JavaFX driver
this.db     // ← throws unless you registered an adapter
```

---

## 6. Write your first web feature

`features/web/login.feature`:

```gherkin
@web
Feature: User login

  Scenario: Successful login redirects to dashboard
    Given I am on the login page
    When I log in as "user@example.com" with password "secret"
    Then I should see the dashboard
```

`pages/LoginPage.ts`:

```typescript
import { BasePage } from 'conductor';
import type { Locator } from 'playwright';

export class LoginPage extends BasePage {
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(...args: ConstructorParameters<typeof BasePage>) {
    super(...args);
    this.usernameInput = this.page.locator('[data-testid="username"]');
    this.passwordInput = this.page.locator('[data-testid="password"]');
    this.submitButton = this.page.locator('[data-testid="login-submit"]');
  }

  async login(username: string, password: string) {
    await this.navigate('/login');
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.waitForLoad();
  }
}
```

`step-definitions/web.steps.ts`:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';
import { LoginPage } from '../pages/LoginPage';

Given('I am on the login page', async function (this: ConductorWorld) {
  await this.page.goto(`${this.config.web.baseUrl}/login`);
});

When('I log in as {string} with password {string}',
  async function (this: ConductorWorld, user: string, password: string) {
    const login = new LoginPage(this.page, this.config);
    await login.login(user, password);
  });

Then('I should see the dashboard', async function (this: ConductorWorld) {
  await this.page.locator('[data-testid="dashboard"]').waitFor({ state: 'visible' });
});
```

Run it:

```bash
npx cucumber-js --tags @web
```

Cucumber picks up `cucumber.js` automatically. The `@web` hook launches the browser, runs your scenario, attaches a screenshot if it fails, and closes the browser.

---

## 7. Add API scenarios

For pure API tests, no browser is needed. The `ApiDriver` wraps Playwright's `APIRequestContext`:

```typescript
import { When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';

When('I create a todo {string} via the API',
  async function (this: ConductorWorld, title: string) {
    if (!this.api.isInitialized) await this.api.init();
    const response = await this.api.post(
      `${this.config.api.baseUrl}/todos`,
      { title, status: 'open' }
    );
    if (!response.ok()) {
      throw new Error(`API failed: ${response.status()}`);
    }
  });

Then('the API should return the todo {string}',
  async function (this: ConductorWorld, title: string) {
    const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
    const todos = await response.json();
    if (!todos.find(t => t.title === title)) {
      throw new Error(`Todo "${title}" not found`);
    }
  });
```

Tag scenarios with `@api`. No hook is needed — `this.api` is lazy.

For **mixed web+API** scenarios (e.g., create on web, verify via API), tag with `@web` and pass the browser context so cookies are shared:

```typescript
if (!this.api.isInitialized) await this.api.init(this.web.context);
```

---

## 8. Add mobile scenarios (Flutter + Maestro)

### Setup

1. Install [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro)
2. Install your Flutter app on a connected device or emulator
3. Set `MAESTRO_DEVICE` to the device ID (`adb devices` or `maestro list-devices`)

### Maestro flows

Conductor doesn't replace Maestro — it **spawns the Maestro CLI**. You author Maestro flows in YAML and Conductor invokes them.

`flows/mobile/launch-app.yaml`:

```yaml
appId: com.example.myapp
---
- launchApp:
    clearState: false
- assertVisible:
    text: "Home"
- takeScreenshot: "home-screen"
```

`step-definitions/mobile.steps.ts`:

```typescript
import { When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';

const MOBILE_TIMEOUT = { timeout: 120000 };

When('the app launches', MOBILE_TIMEOUT, async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('launch-app');
});

When('I tap on {string}', MOBILE_TIMEOUT,
  async function (this: ConductorWorld, label: string) {
    await this.maestro.runOrThrow('tap', { env: { LABEL: label } });
  });
```

### Flutter-specific tips

- **Maestro reads Flutter widgets via the Android accessibility tree.** Wrap interactive widgets in `Semantics(identifier: 'my-id', child: ...)` (Flutter 3.19+) so Maestro can find them with `id:`.
- **Disable animations in test builds** by gating `timeDilation = 0.001` and `MediaQuery(disableAnimations: true)` on a `--dart-define=DISABLE_ANIMATIONS=true` flag.
- **Avoid `autofocus: true` on TextFields in dialogs** — the cursor blink keeps Maestro's `isWindowUpdating` loop active. Tap to focus instead.
- For text input, use `setClipboard` + `pasteText` + `hideKeyboard` instead of `inputText` — faster and avoids the Maestro on-device driver hang on physical Android devices ([known issue #998](https://github.com/mobile-dev-inc/Maestro/issues/998)).

### Running mobile tests

```bash
MAESTRO_DEVICE=emulator-5554 ANDROID_HOME=$HOME/Library/Android/sdk \
  npx cucumber-js --tags @mobile
```

---

## 9. Add desktop scenarios (JavaFX)

Conductor uses [`javafx-driver`](https://www.npmjs.com/package/javafx-driver) which spawns your JavaFX app with an agent JAR (`fxagent.jar`) attached. The agent exposes the JavaFX scene graph over a local HTTP port.

### Setup

1. Download `fxagent.jar`:
   ```bash
   curl -LO https://github.com/nouhouari/java_e2e_agent/releases/download/v0.2.2/fxagent.jar
   ```
2. Build your JavaFX app into a shadow JAR (`build/libs/myapp-all.jar`).
3. Configure the agent JAR path:
   ```typescript
   desktop: {
     agentJar: path.resolve(__dirname, '../agent/fxagent.jar'),
     defaultTimeoutMs: 10000,
     screenshotDir: 'reports/screenshots'
   }
   ```

### Make your widgets findable

Give widgets a `setId(...)` in JavaFX (becomes a Maestro/driver `id:` selector):

```java
var saveBtn = new Button("Save");
saveBtn.setId("dialog-save");
```

### Step definitions

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';
import * as path from 'path';

const DESKTOP_TIMEOUT = { timeout: 60000 };

Given('the desktop app is running', DESKTOP_TIMEOUT, async function (this: ConductorWorld) {
  const jarPath = path.resolve('../desktop/build/libs/myapp-all.jar');
  await this.fx.launch({
    app: 'com.example.myapp.Launcher',
    classpath: jarPath,
    jvmArgs: [`-DAPI_BASE_URL=${this.config.api.baseUrl}`],
    readyTimeoutMs: 30000,
  });
  await this.fx.locator('#main-window').waitFor({ state: 'visible', timeout: 15000 });
});

When('I click the {string} button', DESKTOP_TIMEOUT,
  async function (this: ConductorWorld, id: string) {
    await this.fx.locator(`#${id}`).click();
  });
```

Tag with `@desktop` — the after-hook will close the JavaFX process automatically.

---

## 10. Bring your own database

`DatabaseDriver` is an **abstract class**, not bundled with a default driver. Implement one for your DB:

```typescript
import { DatabaseDriver, QueryResult } from 'conductor';
import { Pool } from 'pg';

export class PostgresDriver extends DatabaseDriver {
  private pool: Pool;
  constructor(connectionString: string) {
    super();
    this.pool = new Pool({ connectionString });
  }
  async connect() { /* connection eager */ }
  async disconnect() { await this.pool.end(); }
  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const r = await this.pool.query(sql, params);
    return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
  }
}
```

Register it in a `Before` hook (typically scoped to `@database`):

```typescript
import { Before } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';
import { PostgresDriver } from './PostgresDriver';

Before({ tags: '@database' }, async function (this: ConductorWorld) {
  this.setDb(new PostgresDriver(process.env.DATABASE_URL!));
});
```

Now `this.db.query(...)` works in any scenario tagged `@database` (and `@cross-platform`).

---

## 11. Cross-platform scenarios

Tag with `@cross-platform` to activate **all** drivers. A typical sync test:

```gherkin
@cross-platform
Scenario: Todo created on web is visible on mobile
  Given I am on the todo web application
  When I log in as "user@example.com" with password "secret"
  And I create a todo titled "Buy groceries"
  Then the API should return the todo "Buy groceries" with status "open"
  And the mobile app should display "Buy groceries"
```

Each `Then` step uses a different driver — they share the **same `ConductorWorld` instance**, the **same data** (via `this.data`), and the same scenario lifecycle.

---

## 12. Running tests

```bash
# All scenarios
npx cucumber-js

# By tag
npx cucumber-js --tags @web
npx cucumber-js --tags '@api or @web'
npx cucumber-js --tags 'not @mobile'

# Specific feature file
npx cucumber-js features/web/login.feature

# Specific scenario by name
npx cucumber-js --name "Successful login"

# Dry-run (validate step definitions exist, no execution)
npx cucumber-js --dry-run
```

**Common env vars:**

```bash
HEADLESS=false BROWSER=firefox npx cucumber-js --tags @web
MAESTRO_DEVICE=emulator-5554 npx cucumber-js --tags @mobile
DEBUG_MAESTRO=0 npx cucumber-js --tags @mobile  # silence Maestro output
```

---

## 13. Allure reporting

Conductor's example is preconfigured with `allure-cucumberjs/reporter`. Cucumber writes JSON + Allure source files into `allure-results/`. Generate the HTML report:

```bash
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
```

**What you get for free:**

- Pass/fail per scenario, grouped by feature
- Step-by-step timeline with durations
- Failure screenshots (web + mobile + desktop)
- Captured stdout/stderr per step
- Filterable by tags (`@web`, `@mobile`, etc.)

Manually attach screenshots from steps:

```typescript
const screenshot = await this.web.takeScreenshot('after-login');
await this.attach(screenshot, 'image/png');
```

---

## 14. CI/CD

A minimal GitHub Actions workflow that runs the non-mobile suites on every push:

```yaml
name: E2E
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: app }
        ports: ['5432:5432']
        options: --health-cmd pg_isready
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm start &        # your app
      - run: npx wait-on http://localhost:3000
      - run: npx cucumber-js --tags 'not @mobile'
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: allure-results
          path: allure-results
```

Mobile tests need either a self-hosted runner with an Android emulator, or [Maestro Cloud](https://docs.maestro.dev/cloud) for cloud-hosted devices.

---

## 15. Troubleshooting

### Cucumber says "0 scenarios"

The cucumber config might not be loading. Verify:

```bash
npx cucumber-js --dry-run --format summary
```

If 0 scenarios still, check that `cucumber.js` exists at the cwd and `paths` points at your `features/` directory.

### "Property X does not exist on type 'ConductorWorld'"

You forgot the `this:` typing on the step function:

```typescript
// ❌ this is `any`
When('...', async function () { this.page.goto(...) });

// ✅ typed
When('...', async function (this: ConductorWorld) { this.page.goto(...) });
```

### Browser doesn't launch

Run `npx playwright install` once. Conductor uses Playwright's bundled browsers, not your system browsers.

### Mobile: `Element not found` despite being visible

Flutter doesn't expose text widgets via the Android `text` attribute — they live in `content-desc` (accessibility tree). For text matching, use Maestro's text selector which checks both:

```yaml
- assertVisible: "My Todos"   # ← matches text + content-desc
```

For ID matching, wrap the widget in `Semantics(identifier: 'my-id', child: ...)`.

### Mobile: Maestro hangs on Flutter dialogs

Known Maestro issue ([#998](https://github.com/mobile-dev-inc/Maestro/issues/998)). Workarounds in this guide:
- Disable Flutter animations: `timeDilation = 0.001`
- Use `setClipboard` + `pasteText` instead of `inputText`
- Set `autofocus: false` on dialog `TextField`s
- If still stuck, retry the Maestro flow once with `--reinstall-driver` (Conductor's `MaestroDriver` does this automatically on gRPC `UNAVAILABLE`)

### Desktop: JavaFX app exits immediately

The agent JAR or app classpath is wrong. Test directly:

```bash
java -javaagent:./agent/fxagent.jar \
     -cp ./build/libs/myapp-all.jar \
     com.example.myapp.Launcher
```

You should see `FXAGENT_READY port=NNNN` on stdout. If not, check the agent JAR matches the driver version (currently v0.2.2) and JavaFX modules are bundled in your shadow JAR.

### Allure report is empty

Make sure `allure-cucumberjs/reporter` is in your `format` array AND that you have a `formatOptions: { snippetInterface: 'async-await' }`. After running tests, the `allure-results/` directory should contain `.json` files.

---

## Where to go next

- [Example project](../example/README.md) — a working multi-platform setup using all 4 drivers
- [`CLAUDE.md`](../CLAUDE.md) — framework internals
- [GitHub Issues](https://github.com/nouhouari/conductor/issues) — report bugs / request features
