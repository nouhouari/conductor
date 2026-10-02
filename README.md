# Conductor

[![CI](https://github.com/nouhouari/conductor/actions/workflows/ci.yml/badge.svg)](https://github.com/nouhouari/conductor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/conductor-e2e.svg?label=conductor-e2e)](https://www.npmjs.com/package/conductor-e2e)
[![npm version](https://img.shields.io/npm/v/conductor-mcp.svg?label=conductor-mcp)](https://www.npmjs.com/package/conductor-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A multi-platform E2E test framework where **one Cucumber scenario** can drive a **web browser**, a **REST API**, a **Flutter mobile app**, a **Flutter desktop app** (macOS), a **JavaFX desktop app**, and a **database** — all from TypeScript.

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
| Desktop automation (Flutter) | Dart VM service / `ext.flutter.driver` JSON-RPC (macOS) |
| Desktop automation (JavaFX) | [`javafx-driver`](https://www.npmjs.com/package/javafx-driver) |
| Database | Plugin interface (bring your own adapter) |
| Reporting | [Allure](https://allurereport.org/) (`allure-cucumberjs`) |

## Quick Start

Conductor is published to the public registries — no `.npmrc`, `settings.xml` or tokens needed.

**TypeScript** — [`@nouhouari/conductor-e2e`](https://www.npmjs.com/package/@nouhouari/conductor-e2e) on npmjs.org:

```bash
npm install @nouhouari/conductor-e2e
```

**Java** — [`io.github.nouhouari.conductor:conductor-core`](https://central.sonatype.com/artifact/io.github.nouhouari.conductor/conductor-core) on Maven Central (see [java/README.md](java/README.md)):

```xml
<dependency>
  <groupId>io.github.nouhouari.conductor</groupId>
  <artifactId>conductor-core</artifactId>
  <version>0.2.0</version>
  <scope>test</scope>
</dependency>
```

**AI-assisted authoring** — the [`@nouhouari/conductor-mcp`](https://www.npmjs.com/package/@nouhouari/conductor-mcp) MCP server runs straight from npmjs.org with `npx -y @nouhouari/conductor-mcp` (see [mcp/README.md](mcp/README.md)).

> The unscoped npm packages [`conductor-e2e`](https://www.npmjs.com/package/conductor-e2e) (last: 0.1.2) and
> [`conductor-mcp`](https://www.npmjs.com/package/conductor-mcp) (last: 0.1.1) are the pre-rename names and are no
> longer updated — use the `@nouhouari/` scoped packages above.

### Configure the MCP server

For Claude Code or Cursor, add `.mcp.json` to your project root:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["-y", "@nouhouari/conductor-mcp@latest"]
    }
  }
}
```

GitHub Copilot CLI (`~/.copilot/mcp-config.json`) additionally needs `"type": "stdio"` and `"tools": ["*"]`; Continue uses `~/.continue/config.json`. Start the client from inside your Conductor project and restart it after changing the config. See [mcp/README.md → Wire Up](mcp/README.md#wire-up) for every client, version pinning and alternatives to `npx`.

See the [**User Guide**](docs/USER_GUIDE.md) for a step-by-step walkthrough of bootstrapping a new E2E project from scratch.

## Why Conductor?

Most E2E frameworks pick one platform. When your product lives on multiple platforms — a web dashboard, a mobile app, a REST API, a desktop client — you end up with **N parallel test suites** that can't share scenarios, page objects, or data lifecycle.

Conductor unifies them behind a single [`ConductorWorld`](src/world/ConductorWorld.ts):

```typescript
async function (this: ConductorWorld) {
  await this.web.launch();                        // Playwright browser
  await this.page.goto('/login');                 // active page
  await this.api.post('/todos', { title: ... });  // shared HTTP client
  await this.maestro.runOrThrow('verify-todo');           // Flutter mobile flow
  await this.flutterDesktop.tap('addButton');             // Flutter desktop (macOS)
  await this.fx.locator('#save-btn').click();             // JavaFX desktop
  await this.db.query('SELECT ...');              // your adapter
}
```

Drivers are lazily instantiated. Tag-driven hooks manage their lifecycle:

| Tag | Effect |
|---|---|
| `@web` / `@cross-platform` | Launches browser, screenshots failures, closes |
| `@mobile` / `@cross-platform` | Targets the configured Maestro device |
| `@flutter-desktop` | Launches Flutter macOS app, screenshots failures, closes |
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
│   ├── mobile/            Flutter todo app (Android + macOS desktop)
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

For mobile, Flutter Desktop, and JavaFX desktop, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

### Flutter Desktop (macOS)

```bash
# Build the test entry point (from repo root)
npm run flutter:build:macos

# Run Flutter Desktop scenarios
cd example
npm run test:flutter-desktop
```

The build uses `lib/main_test.dart` as the entry point (which wires `enableFlutterDriverExtension`) and sets `DISABLE_SWIPE_GESTURES=true` to enable the AppBar Add button and the app-side action registry used by `requestData()`.

## Upgrading

No code APIs changed; only package names, the Java groupId and where packages are hosted.

**TypeScript (`@nouhouari/conductor-e2e`)**

- *Coming from GitHub Packages:* delete `@nouhouari:registry=https://npm.pkg.github.com` (and its `_authToken` line) from `.npmrc`, then `npm install @nouhouari/conductor-e2e@latest`.
- *Coming from the unscoped `conductor-e2e` (≤ 0.1.2):* `npm uninstall conductor-e2e && npm install @nouhouari/conductor-e2e`, change imports to `from '@nouhouari/conductor-e2e'`, and point the hooks in `cucumber.js` at `require.resolve('@nouhouari/conductor-e2e/dist/src/hooks/index')`.

**Java (`conductor-core`)**

- Change the dependency to `io.github.nouhouari.conductor:conductor-core:0.2.0` (was `com.nouhouari.conductor`).
- Delete the `maven.pkg.github.com` `<repository>` from `pom.xml` and the matching `<server>` token from `~/.m2/settings.xml` (projects generated by `conductor-mcp` before 0.2.3 have both).
- Java package names stay `com.nouhouari.conductor.*`, so imports and the glue (`com.nouhouari.conductor.hooks`) are unchanged.

**MCP server (`@nouhouari/conductor-mcp`)**

- Use `["-y", "@nouhouari/conductor-mcp@latest"]` in your client config (not the unscoped `conductor-mcp`), remove any GitHub Packages `.npmrc` mapping, and restart the client.
- Upgrading the server only changes newly scaffolded projects; update existing ones with the TypeScript / Java steps above.

## Documentation

- [**User Guide**](docs/USER_GUIDE.md) — bootstrap a new E2E project, write scenarios, run tests
- [**conductor-mcp**](mcp/README.md) — AI-assisted test authoring for GitHub Copilot CLI, Claude Code, Cursor, Continue
- [**Architecture**](CLAUDE.md) — framework internals (driver lifecycle, hooks, config)
- [Example project README](example/README.md) — guided tour of the working example

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Nourreddine Houari
