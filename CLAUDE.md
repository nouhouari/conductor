# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Conductor is a multi-platform E2E test framework. A single Cucumber scenario can span web (Playwright), REST API (Playwright APIRequestContext), Flutter mobile (Maestro CLI), JavaFX desktop (javafx-driver), and database — all from TypeScript.

## Repo Layout

- `src/` — framework library (drivers, hooks, ConductorWorld, BasePage)
- `config/` — environment configs (default, dev, staging)
- `example/` — BDD consumer: feature files, step definitions, page objects, Maestro flows
- `apps/` — apps under test:
  - `apps/mobile/` — Flutter Android app
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
npm run test:mobile        # mobile scenarios only (@mobile tag)
npm run test:cross         # cross-platform scenarios (@cross-platform tag)
npm test                   # all example scenarios

# Run a single feature file:
cd example && npx cucumber-js features/web/todo-crud.feature --require-module ts-node/register --require-module tsconfig-paths/register --require '../src/hooks/index.ts' --require 'step-definitions/**/*.ts'

# Allure reporting:
npm run report             # generate HTML from allure-results/
npm run report:open        # open report in browser
```

## Architecture

### Core Abstraction: ConductorWorld

`src/world/ConductorWorld.ts` is the Cucumber `World` subclass that wires everything together. It lazily instantiates drivers on first access (`this.web`, `this.api`, `this.maestro`, `this.db`) and exposes convenience getters (`this.page`, `this.request`). Shared test data goes in `this.data` (a `Record<string, unknown>`).

### Drivers

- **WebDriver** (`src/drivers/WebDriver.ts`) — manages Playwright browser lifecycle (launch/close). Accessed via `world.web`; the active `Page` is `world.page`.
- **ApiDriver** (`src/drivers/ApiDriver.ts`) — wraps Playwright `APIRequestContext`. Can share cookies with WebDriver when initialized with `init(context)`.
- **MaestroDriver** (`src/drivers/MaestroDriver.ts`) — spawns the Maestro CLI as a child process. Flows are YAML files in the configured `flowsDir`. Variables pass via `--env K=V`.
- **DatabaseDriver** (`src/drivers/DatabaseDriver.ts`) — abstract class. Users implement their own adapter and register it via `world.setDb(adapter)` in a `Before` hook.

### Tag-Driven Hooks

Hooks in `src/hooks/` auto-manage driver lifecycle based on scenario tags:

| Tag | Effect |
|---|---|
| `@web` or `@cross-platform` | Launches browser before, takes failure screenshot + closes after |
| `@mobile` or `@cross-platform` | Logs target Maestro device before |
| `@database` or `@cross-platform` | Connects DB before, disconnects after |

Hooks are registered via `src/hooks/index.ts`, which also calls `setWorldConstructor(ConductorWorld)`.

### Config System

`config/index.ts` loads a base config from `config/environments/default.ts`, deep-merges an environment overlay (selected by `TEST_ENV` env var), then applies individual env var overrides (`WEB_BASE_URL`, `API_BASE_URL`, `HEADLESS`, `BROWSER`, `MAESTRO_DEVICE`). Config files must export `<name>Config` (e.g., `devConfig`, `stagingConfig`).

### Page Object Pattern

`src/pages/BasePage.ts` provides `navigate()`, `waitForLoad()`, `getTitle()`. Consumer projects extend it (see `example/pages/`). Constructor takes `(page: Page, config: EnvironmentConfig)`.

### Workspace Layout

Root is the framework library (`src/`, `config/`). `example/` is an npm workspace that consumes the framework via `"conductor": "file:.."`. The example has its own `cucumber.js` with profiles (default, web, api, mobile) and resolves `conductor` imports to source via `tsconfig-paths`.

### Key Convention

The example's `cucumber.js` loads framework hooks by direct path (`../src/hooks/index.ts`) — this is required so hooks share the same `@cucumber/cucumber` instance as the runner.
