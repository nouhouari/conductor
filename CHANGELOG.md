# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
