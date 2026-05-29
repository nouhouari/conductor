# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
