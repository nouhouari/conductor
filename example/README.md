# Conductor Example Project

This directory contains a working example that demonstrates how to use the Conductor framework to write multi-platform BDD tests with a single Cucumber scenario spanning web, API, and mobile.

## What's Here

### Pages (`pages/`)

- **`LoginPage.ts`** — extends `BasePage`, provides `login(username, password)` using Playwright locators with `data-testid` selectors.
- **`TodoPage.ts`** — extends `BasePage`, provides `createTodo(title)`, `assertVisible(title)`, and `getTodoCount()`.

Both pages follow the Page Object Model pattern: the constructor accepts `(page: Page, config: EnvironmentConfig)` from the base class, making them easy to instantiate from any step definition.

### Step Definitions (`step-definitions/`)

- **`web.steps.ts`** — Given/When/Then steps that drive the browser via `ConductorWorld.page`. Uses `LoginPage` and `TodoPage`.
- **`api.steps.ts`** — Then step that calls the REST API via `ConductorWorld.api`. Uses plain assertions (no external assertion library required).
- **`cross-platform.steps.ts`** — Then step that invokes a Maestro flow via `ConductorWorld.maestro.runOrThrow(...)`, passing environment variables to the YAML flow.

### Features (`features/`)

- **`web/todo-crud.feature`** — `@web` tagged; exercises the browser-only path.
- **`api/todo-api.feature`** — `@api` tagged; exercises the REST API path (no browser needed).
- **`cross-platform/web-to-mobile-sync.feature`** — `@cross-platform` tagged; a single scenario that creates a todo on the web, verifies it via the API, then confirms it appears in the Flutter mobile app using Maestro.

### Mobile Flows (`flows/mobile/`)

- **`verify-todo.yaml`** — Maestro flow that launches the app, taps "My Todos", asserts the todo title is visible, and takes a screenshot. The `TODO_TITLE` variable is passed in from the step definition.

## Running the Examples

```bash
# Dry-run (no real browser/network/device needed)
npm run test:dry-run

# Web scenarios only
npm run test:web

# API scenarios only
npm run test:api

# All example scenarios (requires step definitions)
npm run test:example

# Cross-platform (requires a running app + connected device with Maestro)
npm run test:cross
```

## Environment Configuration

Copy `.env.example` to `.env` and adjust the values:

```bash
cp .env.example .env
```

Key variables:
- `WEB_BASE_URL` — base URL of the web application under test
- `API_BASE_URL` — base URL of the REST API
- `HEADLESS` — set to `false` to watch the browser
- `MAESTRO_DEVICE` — Maestro device ID for mobile testing
