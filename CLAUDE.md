# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Conductor is a multi-platform E2E test framework. A single Cucumber scenario can span web (Playwright), REST API (Playwright APIRequestContext), Flutter mobile (Maestro CLI), Flutter desktop (Dart VM service), JavaFX desktop (javafx-driver), and database — all from TypeScript.

## Repo Layout

- `src/` — framework library (drivers, hooks, ConductorWorld, BasePage)
- `config/` — environment configs (default, dev, staging)
- `example/` — BDD consumer: feature files, step definitions, page objects, Maestro flows
- `apps/` — apps under test:
  - `apps/mobile/` — Flutter app (Android + macOS desktop)
  - `apps/desktop/` — JavaFX desktop app + `agent/fxagent.jar`
  - `apps/server/` — Express server (REST API + web UI)
- `docker-compose.yml` — PostgreSQL for the server

## Build & Test Commands

```bash
npm install                # install root + example workspace
npm run build              # compile TypeScript (tsc)
npm run test:dry-run       # validate step definitions without running browsers/devices

# Run tests from the example/ workspace:
cd example
npm run test:dry-run       # dry-run example scenarios
npm run test:web           # web scenarios only (@web tag)
npm run test:api           # API scenarios only (@api tag)
npm run test:mobile             # mobile scenarios only (@mobile tag)
npm run test:flutter-desktop    # Flutter Desktop scenarios only (@flutter-desktop tag)
npm run test:cross              # cross-platform scenarios (@cross-platform tag)
npm test                        # all example scenarios

# Build Flutter Desktop (macOS) app for testing (run from repo root):
npm run flutter:build:macos    # flutter build macos --profile -t lib/main_test.dart
                               # --dart-define=API_BASE_URL=http://localhost:3000/api
                               # --dart-define=DISABLE_SWIPE_GESTURES=true

# Run a single feature file:
cd example && npx cucumber-js features/web/todo-crud.feature --require-module ts-node/register --require-module tsconfig-paths/register --require '../src/hooks/index.ts' --require 'step-definitions/**/*.ts'

# Allure reporting:
npm run report             # generate HTML from allure-results/
npm run report:open        # open report in browser
```

## Architecture

### Core Abstraction: ConductorWorld

`src/world/ConductorWorld.ts` is the Cucumber `World` subclass that wires everything together. It lazily instantiates drivers on first access (`this.web`, `this.api`, `this.maestro`, `this.flutterDesktop`, `this.db`) and exposes convenience getters (`this.page`, `this.request`). Shared test data goes in `this.data` (a `Record<string, unknown>`).

### Drivers

- **WebDriver** (`src/drivers/WebDriver.ts`) — manages Playwright browser lifecycle (launch/close). Accessed via `world.web`; the active `Page` is `world.page`.
- **ApiDriver** (`src/drivers/ApiDriver.ts`) — wraps Playwright `APIRequestContext`. Can share cookies with WebDriver when initialized with `init(context)`.
- **MaestroDriver** (`src/drivers/MaestroDriver.ts`) — spawns the Maestro CLI as a child process. Flows are YAML files in the configured `flowsDir`. Variables pass via `--env K=V`.
- **FlutterDesktopDriver** (`src/drivers/FlutterDesktopDriver.ts`) — spawns a Flutter `.app` binary (macOS) and connects to its Dart VM service via WebSocket, sending `ext.flutter.driver` JSON-RPC calls. Public API: `launch()`, `close()`, `tap(finder)`, `enterText(finder, text)`, `getText(finder)`, `waitFor(finder)`, `waitForAbsent(finder)`, `requestData(message)`, `takeScreenshot(name)`. `requestData()` is the primary mechanism for invoking app-side actions (toggle, edit, delete, etc.) via the `enableFlutterDriverExtension` data handler — used instead of finder-based gestures because `hitTestable()` never resolves for widgets inside a `Scrollable` on macOS desktop.
- **DatabaseDriver** (`src/drivers/DatabaseDriver.ts`) — abstract class. Users implement their own adapter and register it via `world.setDb(adapter)` in a `Before` hook.

### Tag-Driven Hooks

Hooks in `src/hooks/` auto-manage driver lifecycle based on scenario tags:

| Tag | Effect |
|---|---|
| `@web` or `@cross-platform` | Launches browser before, takes failure screenshot + closes after |
| `@mobile` or `@cross-platform` | Logs target Maestro device before |
| `@flutter-desktop` | Logs driver availability before, takes failure screenshot + closes driver after |
| `@database` or `@cross-platform` | Connects DB before, disconnects after |

Hooks are registered via `src/hooks/index.ts`, which also calls `setWorldConstructor(ConductorWorld)`. Flutter Desktop hooks live in `src/hooks/flutterDesktop.hooks.ts`.

### Config System

`config/index.ts` loads a base config from `config/environments/default.ts`, deep-merges an environment overlay (selected by `TEST_ENV` env var), then applies individual env var overrides (`WEB_BASE_URL`, `API_BASE_URL`, `HEADLESS`, `BROWSER`, `MAESTRO_DEVICE`). Config files must export `<name>Config` (e.g., `devConfig`, `stagingConfig`).

The `flutterDesktop` key (`FlutterDesktopConfig`) in `config/environments/default.ts` controls the macOS app binary path, the Dart VM service port, and screenshot output directory for the Flutter Desktop driver.

### Page Object Pattern

`src/pages/BasePage.ts` provides `navigate()`, `waitForLoad()`, `getTitle()`. Consumer projects extend it (see `example/pages/`). Constructor takes `(page: Page, config: EnvironmentConfig)`.

### Workspace Layout

Root is the framework library (`src/`, `config/`). `example/` is an npm workspace that consumes the framework via `"conductor-e2e": "file:.."`. The example has its own `cucumber.js` with profiles (default, web, api, mobile) and resolves `conductor-e2e` imports to source via `tsconfig-paths`.

### Key Convention

The example's `cucumber.js` loads framework hooks by direct path (`../src/hooks/index.ts`) — this is required so hooks share the same `@cucumber/cucumber` instance as the runner.
