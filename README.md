# Conductor

A multi-platform E2E test framework that lets a single Cucumber scenario span web, REST API, Flutter mobile (Maestro), and database — all from TypeScript.

## Stack

| Concern | Technology |
|---|---|
| BDD runner | `@cucumber/cucumber` v11 |
| Web automation | Playwright |
| API testing | Playwright `APIRequestContext` |
| Mobile automation | Maestro CLI |
| Database | Plugin interface (bring your own adapter) |
| Reporting | Allure (`allure-cucumberjs`) |

## Getting Started

```bash
npm install
```

Copy `.env.example` to `.env` and adjust the base URLs for your environment.

```bash
cp .env.example .env
```

## Running Tests

```bash
# All example scenarios (dry-run — no browser needed)
npm run test:dry-run

# Web scenarios only
npm run test:web

# API scenarios only
npm run test:api

# Cross-platform (web + API + Maestro)
npm run test:cross

# Full example project
npm run test:example
```

## Allure Report

```bash
npm run report        # generate HTML report from allure-results/
npm run report:open   # open the report in a browser
```

Screenshots captured on failure are automatically attached to the Allure report.

## Environment Config

Set `TEST_ENV` to switch environments (`default`, `dev`, `staging`). Individual values can be overridden with env vars:

| Variable | Description |
|---|---|
| `TEST_ENV` | Environment name (`default` \| `dev` \| `staging`) |
| `WEB_BASE_URL` | Override web base URL |
| `API_BASE_URL` | Override API base URL |
| `HEADLESS` | `true` / `false` |
| `BROWSER` | `chromium` \| `firefox` \| `webkit` |
| `MAESTRO_DEVICE` | Maestro device ID |
| `LOG_LEVEL` | pino log level (`info`, `debug`, …) |

## Project Structure

```
config/                   # Environment config
src/
  drivers/
    WebDriver.ts          # Playwright browser lifecycle
    ApiDriver.ts          # Playwright APIRequestContext wrapper
    MaestroDriver.ts      # Maestro CLI wrapper
    DatabaseDriver.ts     # Abstract plugin interface
  pages/
    BasePage.ts           # Base class — extend this in your project
  world/
    ConductorWorld.ts     # Cucumber World — wires all drivers together
  hooks/                  # Tag-driven lifecycle (@web, @api, @mobile, @database, @cross-platform)
  support/
    logger.ts             # pino logger factory
    retry.ts              # retry() with fixed/exponential backoff
example/                  # Self-contained example (see example/README.md)
```

## Writing Your Own Tests

### 1. Extend `BasePage` for your page objects

```typescript
import { BasePage } from 'conductor/src/pages/BasePage';

export class LoginPage extends BasePage {
  async login(username: string, password: string) {
    await this.navigate('/login');
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-submit"]');
    await this.waitForLoad();
  }
}
```

### 2. Write step definitions using `ConductorWorld`

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor/src/world/ConductorWorld';
import { LoginPage } from './pages/LoginPage';

When('I log in as {string}', async function (this: ConductorWorld, username: string) {
  const login = new LoginPage(this.page, this.config);
  await login.login(username, this.config.api.defaultCredentials.password);
});
```

### 3. Tag scenarios to activate drivers

```gherkin
@web
Scenario: Login redirects to dashboard
  When I log in as "user@example.com"
  Then I should see the dashboard

@cross-platform
Scenario: Record created on web appears on mobile
  When I create a record on web
  Then the mobile app displays the record
```

### 4. Register a database adapter (optional)

```typescript
import { Before } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor/src/world/ConductorWorld';
import { MyPostgresAdapter } from './MyPostgresAdapter';

Before({ tags: '@database' }, async function (this: ConductorWorld) {
  this.setDb(new MyPostgresAdapter(process.env.DATABASE_URL!));
});
```

See [`example/`](example/README.md) for a complete working demonstration.
