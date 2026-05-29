# conductor-example

A standalone project that shows how to use the [Conductor](../README.md) test framework. It is intentionally structured like a real consumer project — it has its own `package.json`, `tsconfig.json`, and `cucumber.js`, and it imports from `conductor-e2e` as a package dependency.

## Setup

```bash
cd example
npm install
```

`conductor-e2e` is listed as `"conductor-e2e": "file:.."` in `package.json`, so npm links it from the parent directory. No separate build step is needed during development — `ts-node` + `tsconfig-paths` resolve the `conductor-e2e` imports directly to the framework source.

## Running tests

```bash
cd example

# Dry-run — resolves all step definitions without a real browser or device
npm run test:dry-run

# Web scenarios only (requires a running web app)
npm run test:web

# API scenarios only (requires a running API server)
npm run test:api

# Mobile scenarios only (requires a connected device + Maestro installed)
npm run test:mobile

# Cross-platform (web + API + Maestro)
npm run test:cross
```

## Allure report

```bash
npm run report        # generate HTML report from allure-results/
npm run report:open   # open in browser
```

## Environment

Copy the framework's `.env.example` and adjust:

```bash
cp ../.env.example .env
```

Key variables:

| Variable | Description |
|---|---|
| `WEB_BASE_URL` | Base URL of the web app under test |
| `API_BASE_URL` | Base URL of the REST API |
| `HEADLESS` | `false` to watch the browser |
| `MAESTRO_DEVICE` | Device ID for Maestro (`maestro devices` to list) |

## Project structure

```
example/
├── package.json                  # "conductor-e2e": "file:.." + own devDeps
├── tsconfig.json                 # paths: { "conductor-e2e": ["../src/index.ts"] }
├── cucumber.js                   # standalone runner config
├── pages/
│   ├── LoginPage.ts              # extends BasePage from conductor-e2e
│   └── TodoPage.ts               # extends BasePage from conductor-e2e
├── step-definitions/
│   ├── web.steps.ts
│   ├── api.steps.ts
│   └── cross-platform.steps.ts
├── features/
│   ├── web/todo-crud.feature
│   ├── api/todo-api.feature
│   └── cross-platform/web-to-mobile-sync.feature
└── flows/
    └── mobile/verify-todo.yaml   # Maestro flow for Flutter
```

## How imports work

All framework classes are imported from `conductor-e2e` — exactly as they would be in a real project after `npm install conductor-e2e`:

```typescript
import { BasePage, ConductorWorld } from 'conductor-e2e';
```

During development (with `"conductor-e2e": "file:.."`), `tsconfig-paths` maps the `conductor-e2e` module specifier to `../src/index.ts` so TypeScript and ts-node both resolve the framework source directly.

The framework's lifecycle hooks are loaded via `cucumber.js`:

```js
require: [
  'node_modules/conductor-e2e/src/hooks/index.ts',  // registers ConductorWorld + tag hooks
  'step-definitions/**/*.ts'
]
```

## What the example demonstrates

### LoginPage and TodoPage — extending BasePage

```typescript
import { BasePage } from 'conductor-e2e';

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

### Step definitions — using ConductorWorld

```typescript
import { When } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';
import { LoginPage } from '../pages/LoginPage';

When('I log in as {string} with password {string}', async function (this: ConductorWorld, username, password) {
  const loginPage = new LoginPage(this.page, this.config);
  await loginPage.login(username, password);
});
```

### Cross-platform scenario

```gherkin
@cross-platform
Feature: Todo created on web appears on Flutter mobile app

  Scenario: Full platform sync
    Given I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I create a todo titled "Buy groceries"
    Then the todo "Buy groceries" appears on the web dashboard
    And the API should return the todo "Buy groceries" with status "open"
    And the Flutter app should display "Buy groceries" in the todo list
```

The `@cross-platform` tag activates all three drivers — Playwright browser, Playwright APIRequestContext, and Maestro CLI — automatically via the framework's hooks.
