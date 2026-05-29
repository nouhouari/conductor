# Conductor

[![CI](https://github.com/nouhouari/conductor/actions/workflows/ci.yml/badge.svg)](https://github.com/nouhouari/conductor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/conductor-e2e.svg)](https://www.npmjs.com/package/conductor-e2e)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A multi-platform E2E test framework where **one Cucumber scenario** can drive a **web browser**, a **REST API**, a **Flutter mobile app**, a **JavaFX desktop app**, and a **database** — all from TypeScript.

```gherkin
@cross-platform
Scenario: Todo created on web appears on the Flutter mobile app
  Given I am on the todo web application
  When I log in as "user@example.com" with password "secret"
  And I create a todo titled "E2E Cross Platform"
  Then the todo "E2E Cross Platform" appears on the web dashboard
  And the API should return the todo "E2E Cross Platform" with status "open"
  And the Flutter app should display "E2E Cross Platform" in the todo list
```

## Stack

| Concern | Technology |
|---|---|
| BDD runner | [`@cucumber/cucumber`](https://github.com/cucumber/cucumber-js) v11 |
| Web automation | [Playwright](https://playwright.dev) |
| API testing | Playwright `APIRequestContext` |
| Mobile automation | [Maestro CLI](https://maestro.mobile.dev) (Flutter / native) |
| Desktop automation | [`javafx-driver`](https://www.npmjs.com/package/javafx-driver) (JavaFX) |
| Database | Plugin interface (bring your own adapter) |
| Reporting | [Allure](https://allurereport.org/) (`allure-cucumberjs`) |

## Quick Start

```bash
npm install conductor-e2e
```

See the [**User Guide**](docs/USER_GUIDE.md) for a step-by-step walkthrough of bootstrapping a new E2E project from scratch.

## Why Conductor?

Most E2E frameworks pick one platform. When your product lives on multiple platforms — a web dashboard, a mobile app, a REST API, a desktop client — you end up with **N parallel test suites** that can't share scenarios, page objects, or data lifecycle.

Conductor unifies them behind a single [`ConductorWorld`](src/world/ConductorWorld.ts):

```typescript
async function (this: ConductorWorld) {
  await this.web.launch();                        // Playwright browser
  await this.page.goto('/login');                 // active page
  await this.api.post('/todos', { title: ... });  // shared HTTP client
  await this.maestro.runOrThrow('verify-todo');   // Flutter mobile flow
  await this.fx.locator('#save-btn').click();     // JavaFX desktop
  await this.db.query('SELECT ...');              // your adapter
}
```

Drivers are lazily instantiated. Tag-driven hooks manage their lifecycle:

| Tag | Effect |
|---|---|
| `@web` / `@cross-platform` | Launches browser, screenshots failures, closes |
| `@mobile` / `@cross-platform` | Targets the configured Maestro device |
| `@desktop` / `@cross-platform` | Launches JavaFX app via agent JAR, closes |
| `@database` / `@cross-platform` | Connects DB before, disconnects after |

## Project Structure

```
conductor/
├── src/                   Framework library
│   ├── drivers/           WebDriver, ApiDriver, MaestroDriver, DatabaseDriver
│   ├── hooks/             Tag-driven Before/After hooks
│   ├── pages/             BasePage to extend
│   ├── world/             ConductorWorld (Cucumber World subclass)
│   └── support/           Logger, retry helpers
├── config/                Environment configs (default/dev/staging)
├── example/               Working multi-platform example project
├── apps/                  Sample apps under test
│   ├── mobile/            Flutter Android todo app
│   ├── desktop/           JavaFX todo app
│   └── server/            Express server + web UI + REST API
├── docs/                  User guide, API docs
└── docker-compose.yml     PostgreSQL for the example server
```

## Running the Example

```bash
# 1. Start PostgreSQL + Express server
docker compose up -d
cd apps/server && npm start &

# 2. Run all scenarios except mobile (no device required)
cd example
npx cucumber-js --tags 'not @mobile' \
  --require-module ts-node/register \
  --require-module tsconfig-paths/register \
  --require '../src/hooks/index.ts' \
  --require 'step-definitions/**/*.ts' \
  --format progress --format allure-cucumberjs/reporter \
  features/**/*.feature

# 3. Open the Allure report
npm run report && npm run report:open
```

For mobile and desktop, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Documentation

- [**User Guide**](docs/USER_GUIDE.md) — bootstrap a new E2E project, write scenarios, run tests
- [**Architecture**](CLAUDE.md) — framework internals (driver lifecycle, hooks, config)
- [Example project README](example/README.md) — guided tour of the working example

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Nourreddine Houari
