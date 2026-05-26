# Conductor

A multi-platform E2E test framework that lets a single Cucumber scenario span web, REST API, Flutter mobile (Maestro), and database — all from TypeScript.

## Stack

| Concern | Technology |
|---|---|
| BDD runner | `@cucumber/cucumber` v11 |
| Web automation | Playwright |
| API testing | Playwright `APIRequestContext` |
| Mobile automation | Maestro CLI |
| Database | Plugin interface (bring your own adapter) |
| Reporting | Allure (`allure-cucumberjs`) |

## Getting Started

```bash
npm install
```

Copy `.env.example` to `.env` and adjust the base URLs for your environment.

```bash
cp .env.example .env
```

## Running Tests

```bash
# All example scenarios (dry-run — no browser needed)
npm run test:dry-run

# Web scenarios only
npm run test:web

# API scenarios only
npm run test:api

# Cross-platform (web + API + Maestro)
npm run test:cross

# Full example project
npm run test:example
```

## Allure Report

```bash
npm run report        # generate HTML report from allure-results/
npm run report:open   # open the report in a browser
```

Screenshots captured on failure are automatically attached to the Allure report.

## Environment Config

Set `TEST_ENV` to switch environments (`default`, `dev`, `staging`). Individual values can be overridden with env vars:

| Variable | Description |
|---|---|
| `TEST_ENV` | Environment name (`default` \| `dev` \| `staging`) |
| `WEB_BASE_URL` | Override web base URL |
| `API_BASE_URL` | Override API base URL |
| `HEADLESS` | `true` / `false` |
| `BROWSER` | `chromium` \| `firefox` \| `webkit` |
| `MAESTRO_DEVICE` | Maestro device ID |
| `LOG_LEVEL` | pino log level (`info`, `debug`, …) |

## Project Structure

```
config/                   # Environment config
src/
  drivers/
    WebDriver.ts          # Playwright browser lifecycle
    ApiDriver.ts          # Playwright APIRequestContext wrapper
    MaestroDriver.ts      # Maestro CLI wrapper
    DatabaseDriver.ts     # Abstract plugin interface
  pages/
    BasePage.ts           # Base class — extend this in your project
  world/
    ConductorWorld.ts     # Cucumber World — wires all drivers together
  hooks/                  # Tag-driven lifecycle (@web, @api, @mobile, @database, @cross-platform)
  support/
    logger.ts             # pino logger factory
    retry.ts              # retry() with fixed/exponential backoff
example/                  # Self-contained example (see example/README.md)
```

## Writing Your Own Tests

### 1. Extend `BasePage` for your page objects

```typescript
import { BasePage } from 'conductor/src/pages/BasePage';

export class LoginPage extends BasePage {
  async login(username: string, password: string) {
    await this.navigate('/login');
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-submit"]');
    await this.waitForLoad();
  }
}
```

### 2. Write step definitions using `ConductorWorld`

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor/src/world/ConductorWorld';
import { LoginPage } from './pages/LoginPage';

When('I log in as {string}', async function (this: ConductorWorld, username: string) {
  const login = new LoginPage(this.page, this.config);
  await login.login(username, this.config.api.defaultCredentials.password);
});
```

### 3. Tag scenarios to activate drivers

```gherkin
@web
Scenario: Login redirects to dashboard
  When I log in as "user@example.com"
  Then I should see the dashboard

@cross-platform
Scenario: Record created on web appears on mobile
  When I create a record on web
  Then the mobile app displays the record
```

### 4. Register a database adapter (optional)

```typescript
import { Before } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor/src/world/ConductorWorld';
import { MyPostgresAdapter } from './MyPostgresAdapter';

Before({ tags: '@database' }, async function (this: ConductorWorld) {
  this.setDb(new MyPostgresAdapter(process.env.DATABASE_URL!));
});
```

See [`example/`](example/README.md) for a complete working demonstration.

---

## Flutter & Maestro Setup

Conductor drives Flutter mobile apps via the [Maestro](https://maestro.mobile.dev) CLI. Maestro launches your app on a simulator or device and executes YAML flows — no app-side instrumentation required.

### 1. Install Maestro

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

Verify the installation:

```bash
maestro --version
```

Maestro requires **Java 11+** on the PATH. On macOS, install it with `brew install openjdk@17` if needed.

### 2. Start a Flutter emulator / device

**iOS Simulator (macOS only)**

```bash
open -a Simulator
# or pick a specific device:
xcrun simctl boot "iPhone 15"
```

**Android Emulator**

```bash
# list available AVDs
emulator -list-avds
# start one
emulator -avd Pixel_7_API_34
```

**Physical device** — connect via USB and confirm it is visible:

```bash
flutter devices
maestro devices   # Maestro's own device list
```

### 3. Build and install your Flutter app

```bash
# debug build for the target platform
flutter build apk --debug          # Android
flutter build ios --debug          # iOS (requires Xcode)

# install on the connected device / emulator
flutter install
```

The app must already be installed before Maestro can launch it.

### 4. Configure the app ID

Set `appId` in every Maestro flow YAML to your Flutter app's bundle/application ID:

```yaml
# example/flows/mobile/verify-todo.yaml
appId: com.example.todoapp   # <-- match AndroidManifest.xml / Info.plist
---
- launchApp:
    clearState: false
- assertVisible:
    text: "${TODO_TITLE}"
- takeScreenshot: "verify-${TODO_TITLE}"
```

Find your app ID in:
- **Android**: `android/app/build.gradle` → `applicationId`
- **iOS**: `ios/Runner/Info.plist` → `CFBundleIdentifier`

### 5. Configure Conductor

Set mobile options in `.env` (or via environment config):

```bash
# .env
MAESTRO_DEVICE=                   # leave blank to use the only connected device
                                   # or set to a specific device ID from `maestro devices`
```

Or override in `config/environments/dev.ts`:

```typescript
import type { EnvironmentConfig } from '../types';

export const devConfig: Partial<EnvironmentConfig> = {
  mobile: {
    deviceId: 'emulator-5554',    # Android emulator ID
    flowsDir: 'example/flows/mobile',
    timeoutMs: 90000,
    maestroBin: '/usr/local/bin/maestro'  # explicit path if not on PATH
  }
};
```

### 6. Write a Maestro flow

Flows live in `example/flows/mobile/` (or wherever `mobile.flowsDir` points). Variables passed from the step definition arrive via `${VAR_NAME}` interpolation:

```yaml
# example/flows/mobile/verify-todo.yaml
appId: com.example.todoapp
---
- launchApp:
    clearState: false
- tapOn:
    text: "My Todos"
- assertVisible:
    text: "${TODO_TITLE}"
- takeScreenshot: "verify-${TODO_TITLE}"
```

Run a flow directly from the CLI to validate it before wiring it into a scenario:

```bash
maestro test example/flows/mobile/verify-todo.yaml --env TODO_TITLE="Buy groceries"
```

### 7. Call Maestro from a step definition

`ConductorWorld.maestro` exposes `run()` and `runOrThrow()`. Pass env vars as a plain object:

```typescript
import { Then } from '@cucumber/cucumber';
import { ConductorWorld } from '../../src/world/ConductorWorld';

Then('the Flutter app should display {string} in the todo list', async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('verify-todo', {
    env: { TODO_TITLE: title }
  });
});
```

`runOrThrow` throws (and fails the scenario) if Maestro exits non-zero or if its output contains `"Flow Failed"`.

### 8. Tag scenarios with `@mobile` or `@cross-platform`

```gherkin
@cross-platform
Scenario: Todo created on web appears on Flutter app
  Given I am on the todo web application
  When I create a todo titled "Buy groceries"
  Then the Flutter app should display "Buy groceries" in the todo list
```

Then run:

```bash
npm run test:cross
# or target mobile only:
npm run test:mobile
```

### MaestroDriver API reference

| Method | Description |
|---|---|
| `run(flowName, opts?)` | Run a flow; returns `{ success, output, exitCode }` — never throws |
| `runOrThrow(flowName, opts?)` | Same as `run()` but throws on failure |

`opts.env` — `Record<string, string>` passed as `--env K=V` flags  
`opts.timeoutMs` — per-call override; defaults to `config.mobile.timeoutMs` (60 s)

### Troubleshooting

| Symptom | Fix |
|---|---|
| `maestro: command not found` | Add `~/.maestro/bin` to `PATH`, or set `mobile.maestroBin` in config |
| `No devices found` | Start an emulator or connect a device; run `maestro devices` to confirm |
| `Flow Failed: Element not found` | The app may not have finished loading — add a `- waitForAnimationToEnd` step before the assertion |
| `Timeout exceeded` | Increase `mobile.timeoutMs` or `opts.timeoutMs`; check device is responsive |
| App not launching | Verify `appId` matches exactly; rebuild and reinstall the app |
