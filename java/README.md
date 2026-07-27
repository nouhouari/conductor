# Conductor (Java)

A Java port of the Conductor E2E framework, built with **Cucumber-JVM +
Playwright for Java + Maven**, developed alongside the existing TypeScript
implementation in `../src` and `../config`. Both implementations run against
the **same** Gherkin feature files (`../example/features`) and Maestro flows
(`../example/flows`) — nothing under `example/` was duplicated or forked.

See the full migration design/rationale in the project's migration plan
(architecture decisions, driver-by-driver porting notes, milestone
breakdown). This README covers day-to-day build/run instructions and current
status.

## Modules

- **`conductor-core`** — the framework: `ConductorWorld`, drivers (`WebDriver`,
  `ApiDriver`, `MaestroDriver`, `JavaFxDriver`, `FlutterDesktopDriver`,
  `DatabaseDriver`), Cucumber-JVM hooks, YAML config loader, `BasePage`.
- **`conductor-example`** — a Java port of `../example`'s step definitions and
  page objects (`LoginPage`, `TodoPage`), plus one JUnit 5 `@Suite` class per
  platform tag (the Java equivalent of `example/cucumber.js`'s named
  profiles).

## Build

```bash
cd java
mvn install                 # builds both modules, runs conductor-core's unit tests
```

## Run a suite

Each suite class under `conductor-example/src/test/java/.../suites/` is a
normal JUnit 5 test — run it like any other:

```bash
mvn -pl conductor-example -am test -Dtest=WebSuiteTest,ApiSuiteTest \
    -Dsurefire.failIfNoSpecifiedTests=false
```

(`-Dsurefire.failIfNoSpecifiedTests=false` is only needed because the `-am`
reactor build also invokes `conductor-core`'s surefire step, which has no
tests matching that filter.)

Suites and what they run (mirrors `example/cucumber.js`'s profiles):

| Suite class | Tag filter | Feature dir |
|---|---|---|
| `DefaultSuiteTest` | none | `example/features/**` |
| `WebSuiteTest` | `@web` | `example/features/web` |
| `ApiSuiteTest` | `@api` | `example/features/api` |
| `MobileSuiteTest` | `@mobile` | `example/features/**` |
| `DesktopSuiteTest` | `@desktop` | `example/features/desktop` |
| `FlutterDesktopSuiteTest` | `@flutter-desktop` | `example/features/flutter-desktop` |
| `CrossPlatformSuiteTest` | `@cross-platform` | `example/features/**` |

### Prerequisites per suite

- **Web/API**: `apps/server` running (`cd apps/server && npm start`) with
  Postgres reachable at the connection string it expects (`docker-compose up`
  from the repo root, or any Postgres matching `apps/server/server.js`'s
  `DATABASE_URL`). Playwright Java downloads its own browser + driver on
  first use — no separate `npx playwright install` step needed, but on Linux
  you may need the OS package list Playwright prints if a browser fails to
  launch (`libwoff1`, `libgstreamer-plugins-bad1.0-0`, etc. — see the error
  message, it's copy-pasteable).
- **Mobile**: the `maestro` CLI on `PATH` and a running emulator/device.
- **Desktop (JavaFX)**: `apps/desktop` built (its Gradle `shadowJar` task)
  and `fxagent.jar` present at `apps/desktop/agent/fxagent.jar`.
- **Flutter Desktop**: `apps/mobile` built for macOS
  (`npm run flutter:build:macos` from the repo root).

## Status

Validated **end-to-end in CI-equivalent conditions** (local Postgres +
`apps/server` + real headless Chromium, no mocks):

- ✅ `ApiSuiteTest` — 8/8 `@api` scenarios pass against a live `apps/server`.
- ✅ `WebSuiteTest` — 9/9 `@web` scenarios pass with real browser automation
  (login, CRUD, screenshots embedded into the Cucumber report).
- ✅ `conductor-core` unit tests (`ConfigLoaderTest`) — deep-merge and
  environment-overlay precedence verified.

Not yet exercised end-to-end (code is written and compiles, but needs
infrastructure this environment didn't have — an Android emulator/Maestro
install, a built `apps/desktop` jar + `fxagent.jar`, a macOS Flutter build):

- `MobileSuiteTest` (`@mobile`)
- `DesktopSuiteTest` (`@desktop`, JavaFX via `fxagent.jar`)
- `FlutterDesktopSuiteTest` (`@flutter-desktop`)
- `CrossPlatformSuiteTest` (`@cross-platform` — needs Maestro)

`JavaFxDriver`'s action/condition vocabulary (`"click"`, `"fill"`,
`"selectOption"`, `"setText"`, wait states `"visible"`/`"hidden"`) was
inferred from `mcp/src/tools/desktop/fxagent-client.ts` and the real call
patterns in `example/step-definitions/desktop.steps.ts` — it has not been
verified against a running `fxagent.jar`, since `fxagent`'s own source isn't
vendored in this repo. Validate this before relying on `DesktopSuiteTest`.

`RemoteScenarioFetcher`/CLI equivalent (fetching scenarios from the requ
scenario API) was intentionally not ported — lower priority, not exercised by
current CI either.

## Config

Config loads the same way conceptually as `config/index.ts`, adapted for a
Java/Maven world — see `ConfigLoader` for the full precedence order
(`config/default.yml` → `config/local-overrides.yml` → `config/${TEST_ENV}.yml`
→ environment-variable overrides). The same environment variables as the TS
side apply: `WEB_BASE_URL`, `API_BASE_URL`, `HEADLESS`, `BROWSER`,
`MAESTRO_DEVICE`, `FLUTTER_DESKTOP_APP_PATH`, `FLUTTER_DESKTOP_VM_PORT`, plus
`TEST_ENV` itself (readable as either a system property `-DTEST_ENV=dev` or an
env var).
