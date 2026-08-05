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
| `RemoteSuiteTest` | none | `.remote-features` (fetched, see below) |

### Prerequisites per suite

- **Web/API**: `apps/server` running (`cd apps/server && npm start`) with
  Postgres reachable at the connection string it expects (`docker-compose up`
  from the repo root, or any Postgres matching `apps/server/server.js`'s
  `DATABASE_URL`). Playwright Java downloads its own browser + driver on
  first use — no separate `npx playwright install` step needed, but on Linux
  you may need the OS package list Playwright prints if a browser fails to
  launch (`libwoff1`, `libgstreamer-plugins-bad1.0-0`, etc. — see the error
  message, it's copy-pasteable).
- **Mobile**: the `maestro` CLI on `PATH` and a running emulator/device with
  the app installed. On a *physical* device, `localhost`/`10.0.2.2` don't
  reach the host — build the APK against the host's LAN IP:
  `cd apps/mobile && flutter build apk --debug -t lib/main.dart --dart-define=API_BASE_URL=http://<host-ip>:3000/api`
  then `adb install -r build/app/outputs/flutter-apk/app-debug.apk`.
- **Desktop (JavaFX)**: `apps/desktop` built (its Gradle `shadowJar` task)
  and `fxagent.jar` present at `apps/desktop/agent/fxagent.jar`. Run with
  `API_BASE_URL_FOR_DESKTOP=http://localhost:3000/api` — the app expects the
  `/api` suffix, which `config.api.baseUrl` doesn't carry.
- **Flutter Desktop**: `apps/mobile` built for macOS
  (`npm run flutter:build:macos` from the repo root). Rebuild it whenever
  `apps/mobile/lib` changes — a stale `.app` fails with
  `unknown action "…"` from the driver-extension handler.

## Status

Validated **end-to-end against the real apps** (local Postgres +
`apps/server` + real headless Chromium + a real Android device + the JavaFX
and Flutter macOS builds, no mocks):

- ✅ `ApiSuiteTest` — 8/8 `@api` scenarios.
- ✅ `WebSuiteTest` — 9/9 `@web` scenarios with real browser automation.
- ✅ `DesktopSuiteTest` — 8/8 `@desktop` scenarios against a live
  `fxagent.jar`.
- ✅ `FlutterDesktopSuiteTest` — 5/5 `@flutter-desktop` scenarios.
- ✅ `MobileSuiteTest` — 8/8 `@mobile` scenarios via Maestro on a device.
- ✅ `CrossPlatformSuiteTest` — 10/10 `@cross-platform` scenarios.
- ✅ `RemoteSuiteTest` — 9/9 scenarios sourced from a live scenario API,
  fetched and reconstructed into `.feature` files, then executed against a
  real browser.
- ✅ `conductor-core` unit tests (`ConfigLoaderTest`,
  `RemoteScenarioFetcherTest`) — deep-merge and environment-overlay
  precedence, plus remote-scenario query building, error surfacing, tag
  recovery and file reconstruction.

`JavaFxDriver`'s vocabulary is now verified against a running `fxagent.jar`
(v1.0.0, package `com.hin.fxagent`; the wire protocol is unchanged from the
earlier v0.3.0 build): actions are `"click"`, `"clear"`, `"fill"`, `"select"`,
`"setText"`, and waits are polled client-side via
`POST /api/v1/elements/query` — the agent's `/api/v1/elements/wait` cannot
express `hidden`/absent states (it 500s when nothing matches).

`RemoteScenarioFetcher` and its CLI are ported (see "Remote scenarios" below):
scenario fetching, feature-file reconstruction and the `remote` suite all have
Java equivalents, verified to produce byte-identical `.feature` output to the
TypeScript implementation for the same API payload.

## Config

Config loads the same way conceptually as `config/index.ts`, adapted for a
Java/Maven world — see `ConfigLoader` for the full precedence order
(`config/default.yml` → `config/local-overrides.yml` → `config/${TEST_ENV}.yml`
→ environment-variable overrides). The same environment variables as the TS
side apply: `WEB_BASE_URL`, `API_BASE_URL`, `HEADLESS`, `BROWSER`,
`MAESTRO_DEVICE`, `FLUTTER_DESKTOP_APP_PATH`, `FLUTTER_DESKTOP_VM_PORT`, plus
`TEST_ENV` itself (readable as either a system property `-DTEST_ENV=dev` or an
env var).

## Remote scenarios

Java port of `src/scenarios/RemoteScenarioFetcher.ts` and `src/scenarios/cli.ts`
— sources scenarios from the requ scenario API and reconstructs them into
`.feature` files on disk, so Cucumber (which only reads filesystem globs) can
run them without touching `example/features/`.

Configure a `remoteScenarios` block in `config/*.yml` (or override it with the
same `REMOTE_SCENARIOS_*` env vars the TS side uses — `REMOTE_SCENARIOS_URL`,
`_PROJECT`, `_OUTPUT_DIR`, `_STORY`, `_REQUIREMENT`, `_PHASE`, `_MODE`,
`_TAGS`, `_FEATURE`, `_Q`, `_VALID`):

```yaml
remoteScenarios:
  baseUrl: http://localhost:8788/api
  project: demo
  outputDir: .remote-features
  filters:
    tags: "@web"
```

Fetch, then run — the Java equivalent of `npm run test:remote`:

```bash
# 1. fetch + reconstruct .feature files  (equivalent of `npm run fetch:remote`)
mvn -pl conductor-core exec:java \
  -Dexec.mainClass=com.nouhouari.conductor.scenarios.FetchFeaturesCli

# 2. run them
mvn -pl conductor-example test -Dtest=RemoteSuiteTest
```

Filtering happens server-side at fetch time; a local
`-Dcucumber.filter.tags` expression still works on top. Feature-level tags
(e.g. `@web`) are recovered as the tags common to every scenario in a feature
that do not appear on that scenario's own tag lines, and re-emitted above
`Feature:` so tag filters and suites keep matching.
