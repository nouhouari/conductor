# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.6] — 2026-06-21

### Added

- **Remote scenario sourcing** — opt-in mode to run Cucumber scenarios fetched from the requ scenario API (`GET /api/scenarios`) instead of the local `features/` folder. The local filesystem flow is unchanged and remains the default.
  - `fetchScenarios()` / `reconstructFeatureFiles()` (exported from `src/scenarios/RemoteScenarioFetcher.ts`) — fetch scenarios with server-side filters (`project`, `story`, `requirement`, `phase`, `mode`, `tags`, `feature`, `q`, `valid`) and reconstruct them into `.feature` files grouped by feature, recovering feature-level tags, inserting `Background:`, and preserving `Examples:`.
  - `conductor-fetch-features` bin (`src/scenarios/cli.ts`) — prefetch step that writes the reconstructed features to disk.
  - New optional `remoteScenarios` config block with `REMOTE_SCENARIOS_*` env-var overrides.
  - Example: new `remote` cucumber profile and `fetch:remote` / `test:remote` / `test:remote:dry` scripts.
- **New exported types**: `RemoteScenariosConfig`, `RemoteScenariosFilters`, `RemoteScenarioSummary`, `ReconstructResult`

## [conductor-mcp 0.1.6] — 2026-06-21

### Added

- **`init_project` scaffolds the remote scenario mode (opt-in)** — newly bootstrapped projects now include the `remote` cucumber profile, the `fetch:remote` / `test:remote` / `test:remote:dry` scripts, a commented `REMOTE_SCENARIOS_*` section in `.env.example`, `.remote-features/` in `.gitignore`, and a "Remote Scenarios" section in the README. Local feature files remain the default; the remote profile is inert until `npm run test:remote` is run. No new init parameter or prompt.
- Bootstrapped projects now depend on `@nouhouari/conductor-e2e@^0.1.6` (provides the `conductor-fetch-features` bin used by `fetch:remote`).

## [0.1.5] — 2026-06-19

### Added

- **`FlutterDesktopDriver`** — 9 new methods expanding the gesture and query API:
  - `doubleTap(finder, timeoutMs?)` — double-tap gesture (`double_tap` command)
  - `longPress(finder, timeoutMs?)` — long-press gesture (`long_press` command)
  - `scroll(finder, dx, dy, durationMs?, frequency?, timeoutMs?)` — scroll a `Scrollable` widget by pixel offset
  - `scrollIntoView(finder, alignment?, timeoutMs?)` — scroll until a widget is visible; `alignment` 0.0 = top, 0.5 = center, 1.0 = bottom
  - `clearText(finder, timeoutMs?)` — clear a text field (enables text-entry emulation, taps to focus, sends empty string)
  - `isVisible(finder, timeoutMs?)` → `boolean` — non-throwing visibility probe; returns `true`/`false` instead of throwing (default probe timeout 500 ms)
  - `getOffset(finder, offsetType?, timeoutMs?)` → `{ dx, dy }` — get widget screen coordinates (`get_offset` command); `offsetType`: `'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center'`
  - `waitForCondition(condition, timeoutMs?)` — wait for the app to reach a quiescent state, the Flutter equivalent of `page.waitForLoadState()`; conditions: `'NoPendingFrames'`, `'NoTransientCallbacks'`, `'FirstFrameRasterized'`
  - `setFrameSync(enabled, timeoutMs?)` — pause/resume Flutter's frame-sync during heavy animations, mirrors disabling CSS transitions in web tests
- **`FlutterDesktopDriver.connect(vmServiceUrl, timeoutMs?)`** — connect to an already-running Flutter app via its Dart VM service URL, without spawning a process. Enables use on Android (after `adb forward`), iOS (after `iproxy`), and Windows/Linux desktop. Accepts both HTTP (`http://localhost:PORT/TOKEN/`) and WebSocket (`ws://localhost:PORT/TOKEN/ws`) form. `isLaunched` now returns `true` after `connect()` as well as `launch()`.
- **New exported types**: `OffsetType`, `Offset`, `WaitCondition`
- **Example step definitions** for all new `FlutterDesktopDriver` methods

## [conductor-mcp 0.1.4] — 2026-06-19

### Added

- **`@nouhouari/conductor-mcp`**: Added `flutter` API surface to the built-in reference (`get_api_reference`, `list_steps` surface filter). Documents the full `FlutterDesktopDriver` public API — lifecycle (`launch`, `connect`, `close`), finders, gesture/interaction methods (`tap`, `doubleTap`, `longPress`, `enterText`, `clearText`, `scroll`, `scrollIntoView`), query methods (`getText`, `getOffset`, `isVisible`), wait methods (`waitFor`, `waitForAbsent`, `waitForCondition`), and advanced utilities (`requestData`, `setFrameSync`, `takeScreenshot`). Also documents the `@flutter-desktop` tag hook and `FlutterDesktopConfig`. Updated the `world` surface to include the `flutterDesktop` and `isFlutterDesktopLaunched` getters.

## [conductor-mcp 0.1.2] — 2026-06-19

### Changed

- **`@nouhouari/conductor-mcp`**: Renamed package from `conductor-mcp` to `@nouhouari/conductor-mcp` and switched registry from npm to GitHub Packages. Consumers should update their install command to `npm install @nouhouari/conductor-mcp` and configure `@nouhouari:registry=https://npm.pkg.github.com` in their `.npmrc`.

## [0.1.3] — 2026-06-19

### Changed

- **`conductor-e2e`**: Renamed package to `@nouhouari/conductor-e2e` and switched registry from npm to GitHub Packages. Update installs to `npm install @nouhouari/conductor-e2e` with `@nouhouari:registry=https://npm.pkg.github.com` in `.npmrc`.

### Added

- **`FlutterDesktopDriver`** — new TypeScript driver that launches a Flutter macOS `.app` binary, connects to its Dart VM service via WebSocket, and issues `ext.flutter.driver` JSON-RPC commands. Public API: `launch()`, `close()`, `tap(finder)`, `enterText(finder, text)`, `getText(finder)`, `waitFor(finder)`, `waitForAbsent(finder)`, `requestData(message)`, `takeScreenshot(name)`.
- **`requestData()` action dispatch pattern** — primary mechanism for invoking app-side actions (toggle, edit, delete, etc.) via `enableFlutterDriverExtension`. Bypasses `hitTestable()` which never resolves for widgets inside a `ListView` on macOS desktop.
- **`@flutter-desktop` tag** — new tag-driven hook that logs driver availability before the scenario and takes a failure screenshot + closes the driver after. Lives in `src/hooks/flutterDesktop.hooks.ts`.
- **`FlutterDesktopConfig`** — new config key controlling the macOS `.app` binary path, Dart VM service port, and screenshot output directory.
- **`apps/mobile/lib/main_test.dart`** — Flutter test entry point that wires `enableFlutterDriverExtension` to the action registry via JSON dispatch.
- **`apps/mobile/lib/driver_actions.dart`** — app-side action registry for `toggleTodo`, `editTodoTitle`, `deleteTodo`, `setDialogText`, `refresh`, and `waitUntilLoaded`.
- **macOS `DebugProfile.entitlements`** — adds `network.client` entitlement so the sandboxed profile build can reach the local API server.
- **Flutter Desktop example scenarios** — feature file, step definitions, cucumber profile (`flutter-desktop`), and `npm run test:flutter-desktop` script covering home screen, create, toggle, edit, and delete (5 scenarios / 24 steps).
- **`flutter:build:macos` script** — builds the Flutter macOS app in profile mode with `main_test.dart` as the entry point and injects `API_BASE_URL` and `DISABLE_SWIPE_GESTURES` dart-defines.

### Fixed

- macOS sandbox blocked outgoing HTTP from the profile build (missing `network.client` entitlement).
- Race condition between `initState _loadTodos()` and test setup — resolved via `waitUntilLoaded` requestData action.
- Flutter driver touch events do not fire `onPressed` on macOS desktop — bypassed via `requestData`.
- `TestTextInput` mock `_client` is null on macOS — text is now set directly on the controller.

## [conductor-mcp 0.1.1] — 2026-05-29

### Fixed

- **conductor-mcp**: Quote handling in `scaffold_page_object`, `scaffold_step_def`, and `scaffold_maestro_flow`. Locator selectors like `role=textbox[name='Title']`, step patterns containing apostrophes (`I don't see {string}`), and Maestro values containing `"` were dropped verbatim into single-quoted JS literals or YAML scalars, producing broken source. All three sites now use `JSON.stringify`, which selects the quote style and escapes special characters. Fixes #1.

### Added

- **conductor-mcp@0.1.0** — Model Context Protocol (stdio) server for AI-assisted E2E test authoring. Exposes 12 tools across discovery (list steps, page objects, flows, features), scaffolding (bootstrap new projects, create features/steps/pages/flows), and validation (dry-run scenarios). Lets Claude Code, Cursor, and Continue users bootstrap a Conductor project or add tests without leaving their editor. Versioned independently on `mcp-v*` tag prefix.
- **conductor-mcp**: Discovery/scaffolding/validation tools now accept an optional `projectPath` argument so the AI can point the server at a specific Conductor project. When omitted, `resolveProjectContext` now also walks **down** one level through common subdirs (`tests/`, `e2e/`, `e2e-conductor/`, `qa/`, …) — makes the server usable in monorepos where the test project lives below the workspace root.
- **conductor-mcp**: Bootstrap template `cucumber.js` now includes the `summary` formatter alongside `progress-bar`, so a failing run prints the actual error instead of three opaque lines.
- **conductor-mcp**: Scaffolded `api.steps.ts` now ships a working `POST` example demonstrating the correct `ApiDriver.post(url, body, options?)` signature — preempts users reaching for the Playwright `{ data: ... }` shape.
- **conductor-mcp**: `scaffold_step_def` now derives parameter identifiers correctly via a three-tier strategy: (1) explicit `paramNames` if supplied, (2) **TypeScript AST walk** of the body — parses with `ts.createSourceFile` and classifies each `Identifier` by its parent node, so property keys in object literals (`{ email: ... }`), member-access names (`account.email`), declarations (`const`/`let`/`var`/parameters/destructuring), labels, and type-position references are all correctly excluded; shorthand property assignments (`{ password }`) are recognized as references; (3) generic `value`/`value2`/`count` as last resort. The earlier regex heuristic mistook property keys for references and dropped identifiers inside template-literal interpolations — both blockers reported in dogfood. `typescript` is now a runtime dep of `conductor-mcp` (added to the published package).
- **conductor-mcp**: `scaffold_page_object` accepts per-method `body` (in addition to `signature`), so users can ship working method implementations instead of `// TODO` stubs. The renderer no longer adds `async` to methods with non-Promise return types like `Locator`, fixing TS2326 errors on common page-object patterns.
- **conductor-mcp**: Scaffolded `tsconfig.json` now includes `"DOM"` in `lib`, so step definitions reaching `localStorage` / `Storage` / `Window` via `page.evaluate(...)` type-check correctly.
- **conductor-mcp**: Scaffolded `cucumber.js` now loads `support/**/*.ts` between the framework hooks and step definitions, and `init_project` scaffolds a `support/timeout.ts` that bumps Cucumber's default 5-second step timeout to 30 seconds — fixes spurious timeouts on real browser/app/HTTP steps.
- **conductor-mcp**: `init_project.includeSamples` now defaults to `false`. The previous `true` default left placeholder `example.feature` files in every project, surfacing as undefined-scenario noise in `npm test`. Real scenarios should come from `scaffold_feature` / `scaffold_step_def`. Set `includeSamples: true` explicitly only when the user wants a runnable demo.
- **conductor-mcp**: `init_project` accepts an optional `webBaseUrl` so the user's target URL ends up in `.env.example` directly. The tool description teaches the AI to ask the user for this during setup; if no URL is provided, the project uses `http://localhost:3000` as a safe default.
- **conductor-mcp**: New tool `remove_samples` — deletes the bootstrap placeholder files (`example.feature`, sample step-defs, `ExamplePage.ts`, sample Maestro flows). Only deletes files whose content is byte-equivalent to the original sample, so user edits are preserved (pass `force: true` to override). Optional `platforms` arg restricts the scope. Empty directories left behind are removed too. Total tool count is now **13**.

## [0.1.2] — 2026-05-29

### Changed

- **`conductor-e2e`**: `loadConfig()` now calls `import 'dotenv/config'` at module load, so a project's `.env` file is read automatically. Previously the scaffold wrote `.env.example` and the README referenced it, but nothing actually loaded it.
- **`conductor-e2e`**: Default `api.baseUrl` is now `http://localhost:3000` (no `/api` suffix). Step definitions write the full path including any `/api/...` prefix, avoiding the previous `/api/api/...` collision. `.env.example` updated accordingly. **Migration**: if your step defs wrote `${baseUrl}/todos` expecting `/api/` to be baked into baseUrl, prepend `/api/` to those URLs (or set `API_BASE_URL=http://localhost:3000/api` in your `.env` to keep the old behavior).

### Added

- **`conductor-e2e`**: `dotenv` is now a runtime dependency.

## [0.1.1] — 2026-05-29

### Changed

- **Renamed npm package from `conductor` to `conductor-e2e`.** The name `conductor` is taken on the npm registry by an unrelated project; v0.1.0 was tagged but could not be published. v0.1.1 is the first version published to npm. Consumers should `npm install conductor-e2e` and import from `'conductor-e2e'`.

## [0.1.0] — 2026-05-29

### Added

- `ConductorWorld` — Cucumber `World` subclass that lazily instantiates web/api/maestro/desktop/database drivers
- `WebDriver` — Playwright browser lifecycle (chromium / firefox / webkit), failure screenshots
- `ApiDriver` — Playwright `APIRequestContext` wrapper, optional cookie sharing with web context
- `MaestroDriver` — spawns Maestro CLI for Flutter / native mobile testing; live stdout streaming via `DEBUG_MAESTRO`; auto-retry with `--reinstall-driver` on gRPC `UNAVAILABLE`; adb-based screenshots
- `JavaFxDriver` integration via `javafx-driver@^0.2.2` for desktop JavaFX app automation
- `DatabaseDriver` — abstract class; users register their own adapter via `world.setDb(adapter)`
- `BasePage` — Playwright page object base class with `navigate()`, `waitForLoad()`, `getTitle()`
- Tag-driven hooks: `@web`, `@mobile`, `@desktop`, `@database`, `@cross-platform`
- Environment config system with overlays (`default` / `dev` / `staging`) and env var overrides (`WEB_BASE_URL`, `API_BASE_URL`, `HEADLESS`, `BROWSER`, `MAESTRO_DEVICE`)
- Pino-based structured logger
- `retry()` helper with fixed/exponential backoff
- Allure reporting integration via `allure-cucumberjs`
- Example project (`example/`) demonstrating web + API + mobile + desktop + cross-platform scenarios
- Sample apps under test (`apps/mobile`, `apps/desktop`, `apps/server`)
- GitHub Actions CI (build, type-check, dry-run scenarios)
- GitHub Actions release pipeline (tag-triggered, builds, creates GitHub release, publishes to npm with provenance)
- [User Guide](docs/USER_GUIDE.md) covering project bootstrap, configuration, all platforms, Allure, CI/CD, troubleshooting
