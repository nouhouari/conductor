# conductor-mcp

**Model Context Protocol server for AI-assisted E2E test authoring with Conductor.** Let AI assistants (Claude Code, Cursor, Continue) bootstrap Conductor test projects and write scenarios without leaving your editor.

## What It Does

`conductor-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server (stdio) that gives AI assistants a **structured tool surface** to work with the [conductor-e2e](https://www.npmjs.com/package/conductor-e2e) multi-platform E2E test framework.

With 12 tools across discovery, scaffolding, and validation, it supports two workflows:

1. **Fresh project**: "Set up an E2E test project for web + API" → AI calls `init_project` once → you run `npm install` → have a dry-run-green project.
2. **Existing project**: "Add an E2E test for the password reset flow" → AI discovers existing steps and page objects → scaffolds new artifacts → validates without touching unrelated code.

## Install

```bash
npm install conductor-mcp
```

Requires Node ≥ 18. (The target project will also need `conductor-e2e` installed; `init_project` handles this automatically for new projects.)

## Wire Up

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["-y", "conductor-mcp"]
    }
  }
}
```

Restart Claude Code. The **Conductor MCP** tools will be available to any AI in that workspace.

### Cursor

Same as Claude Code — Cursor reads `.mcp.json`. Restart the editor after adding the entry.

### Continue

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "name": "conductor",
        "command": "npx",
        "args": ["-y", "conductor-mcp"]
      }
    ]
  }
}
```

Restart Continue (or your IDE with Continue installed).

## User Flows

### Flow A: Bootstrap a New Project

**You type:**
> "Set up an E2E test project for web + API using Conductor."

**AI does:**
1. Calls `init_project` with `platforms: ['web', 'api']`, `includeSamples: true`.
2. Tells you to `cd` into the new directory and run `npm install && npx playwright install chromium && npm run test:dry-run`.
3. Advises you to restart the MCP server so it picks up the new `cucumber.js`.

**You get:**
- A ready-to-extend project with a working feature file, step definitions, and page objects per platform.
- Green dry-run (all scaffolded steps are registered).
- A `.mcp.json` with the same snippet above — now the AI has access to discovery tools inside your project.

### Flow B: Add a Test to Existing Project

**You type (inside an existing Conductor project):**
> "Add an E2E test for user password reset via the web UI."

**AI does:**
1. Calls `list_steps` to see what steps already exist.
2. Calls `list_page_objects` to find relevant page objects (e.g., `LoginPage`).
3. Calls `scaffold_feature` to create `features/web/password-reset.feature` with a skeleton scenario.
4. Calls `scaffold_step_def` to add any missing steps to `step-definitions/web.steps.ts`.
5. Calls `dry_run_scenario` to validate the new scenario resolves (no undefined steps).

**You get:**
- A new feature file with idiomatic naming and tags.
- Step definitions that match Conductor's conventions.
- Validation that everything wires together (before you have to run the browser).

## Tool Catalog

Tools are grouped by category. For inputs and outputs, see [Tool Reference](#tool-reference) below.

### Discovery (6 tools)

| Tool | Purpose |
|---|---|
| `list_steps` | Walk step definitions and return all registered steps (pattern, type, file, line) |
| `list_page_objects` | Parse page objects and return classes, methods, and signatures |
| `list_maestro_flows` | List Maestro YAML flows, env vars, and step commands |
| `list_features` | Parse feature files and return scenarios with their steps and tags |
| `get_conductor_api` | Get markdown reference for ConductorWorld, drivers, and BasePage |
| `get_config` | Return the resolved environment config and active env vars |

### Scaffolding (5 tools)

| Tool | Purpose |
|---|---|
| `init_project` | Bootstrap a brand-new test project from scratch |
| `scaffold_feature` | Create a new Gherkin feature file with the right platform tag |
| `scaffold_step_def` | Create or append step definitions in idiomatic TypeScript |
| `scaffold_page_object` | Create a page object class extending BasePage |
| `scaffold_maestro_flow` | Create a Maestro YAML flow for mobile testing |

### Validation (1 tool)

| Tool | Purpose |
|---|---|
| `dry_run_scenario` | Run `cucumber-js --dry-run` and report undefined steps |

## Tool Reference

### Discovery Tools

#### `list_steps`

**Input:**
- `filter` (optional): `'given'` | `'when'` | `'then'` — filter by step type.
- `q` (optional): string — search pattern (matches pattern text).

**Output:**
```json
[
  {
    "pattern": "I create a todo titled {string}",
    "type": "When",
    "file": "step-definitions/web.steps.ts",
    "line": 42,
    "paramTypes": ["string"],
    "usedInFeatures": ["features/web/todo-crud.feature"]
  }
]
```

**Example:** List all `When` steps used in web tests to decide if you need a new step or can reuse an existing one.

---

#### `list_page_objects`

**Input:** (none)

**Output:**
```json
[
  {
    "className": "TodoPage",
    "file": "pages/TodoPage.ts",
    "extends": "BasePage",
    "methods": [
      { "name": "createTodo", "params": "(title: string)", "returnType": "Promise<void>" },
      { "name": "getTodoCount", "params": "()", "returnType": "Promise<number>" }
    ]
  }
]
```

**Example:** Before writing a step, check if a page object already has the locators and methods you need.

---

#### `list_maestro_flows`

**Input:** (none)

**Output:**
```json
[
  {
    "name": "create-todo",
    "file": "flows/mobile/create-todo.yaml",
    "envVars": ["TODO_TITLE", "DEVICE_ID"],
    "steps": ["launchApp", "tapOn", "inputText", "assertVisible"]
  }
]
```

**Example:** Discover which Maestro flows are available before writing a mobile step that invokes one.

---

#### `list_features`

**Input:**
- `tag` (optional): string — filter by Gherkin tag (e.g., `'@web'`, `'@api'`).

**Output:**
```json
[
  {
    "file": "features/web/todo-crud.feature",
    "tags": ["@web"],
    "scenarios": [
      {
        "name": "User creates a todo",
        "tags": ["@smoke"],
        "steps": [
          { "type": "Given", "text": "I am on the todo application" },
          { "type": "When", "text": "I create a todo titled \"Buy milk\"" },
          { "type": "Then", "text": "the todo appears in the list" }
        ]
      }
    ]
  }
]
```

**Example:** Understand existing test coverage before writing a new scenario.

---

#### `get_conductor_api`

**Input:**
- `surface` (optional): `'world'` | `'web'` | `'api'` | `'maestro'` | `'fx'` | `'db'` | `'page'` — filter to one driver or component. Default: all.

**Output:** Markdown reference (signatures, descriptions, trigger points).

**Example:**
```
## ConductorWorld

public api: ApiDriver

Lazy-instantiated Playwright APIRequestContext wrapper. Shares cookies with the WebDriver if both are active.

Example:
  const result = await this.api.get('/todos');
  const created = await this.api.post('/todos', { title: 'Buy milk' });
```

**Use before:** writing step definitions to understand what methods are available on `this.web`, `this.api`, etc.

---

#### `get_config`

**Input:** (none)

**Output:**
```json
{
  "web": {
    "baseUrl": "http://localhost:3000",
    "headless": true,
    "browserName": "chromium",
    "viewport": { "width": 1280, "height": 720 }
  },
  "api": {
    "baseUrl": "http://localhost:3000/api",
    "timeoutMs": 30000
  },
  "mobile": {
    "flowsDir": "flows/mobile",
    "maestroDevice": "iPhone 15",
    "timeoutMs": 120000
  },
  "env": {
    "TEST_ENV": "dev",
    "WEB_BASE_URL": "http://localhost:3000",
    "HEADLESS": "true"
  }
}
```

**Use before:** writing a step that depends on configuration (base URLs, timeouts, device names).

---

### Scaffolding Tools

#### `init_project`

**Input:**
- `path` (string, required): Absolute path to the target directory (created if it doesn't exist).
- `name` (string, required): Project name (used in `package.json` and README).
- `platforms` (array of `'web'` | `'api'` | `'mobile'` | `'desktop'` | `'cross-platform'`, required): Which platforms to configure.
- `includeSamples` (boolean, optional, default `true`): Write starter feature + step-def + page/flow files that pass dry-run.
- `force` (boolean, optional, default `false`): Overwrite if the target directory is non-empty.

**Output:**
```json
{
  "path": "/home/user/my-e2e",
  "files": [
    "package.json",
    "tsconfig.json",
    "cucumber.js",
    ".env.example",
    ".gitignore",
    "README.md",
    "features/web/smoke.feature",
    "step-definitions/web.steps.ts",
    "pages/HomePage.ts",
    "flows/mobile/launch-app.yaml"
  ],
  "nextSteps": [
    "cd /home/user/my-e2e",
    "npm install",
    "npx playwright install chromium",
    "npm run test:dry-run",
    "# Restart the MCP server so it picks up the new cucumber.js"
  ]
}
```

**Notes:**
- Does **not** run `npm install` — that's your step.
- Depends on `conductor-e2e` being published on npm. The generated `package.json` pins a specific version.
- The `cucumber.js` profile and directory structure match the [User Guide](../docs/USER_GUIDE.md) — use this to bootstrap a fresh project in seconds.

---

#### `scaffold_feature`

**Input:**
- `platform` (required): `'web'` | `'api'` | `'mobile'` | `'desktop'` | `'cross-platform'`.
- `name` (string, required): Feature name (becomes filename in `features/<platform>/<name>.feature`).
- `scenarios` (array, required): Scenarios to include:
  - `name` (string): Scenario name.
  - `steps` (array of strings): Gherkin steps.

**Output:**
```json
{
  "path": "features/web/password-reset.feature",
  "content": "@web\nFeature: User can reset password\n\n  Scenario: Reset password via email link\n    Given I am on the login page\n    When I click \"Forgot Password\"\n    And I enter email \"user@example.com\"\n    Then I should see \"Check your email\""
}
```

**Notes:**
- Refuses to overwrite unless you explicitly ask.
- Automatically applies the platform tag (`@web`, `@api`, etc.).
- The AI is responsible for writing idiomatic Gherkin; this tool just writes the file.

---

#### `scaffold_step_def`

**Input:**
- `platform` (string, required): Platform prefix (becomes part of filename, e.g., `web.steps.ts`).
- `name` (string, required): Filename (becomes `step-definitions/<name>.steps.ts`).
- `steps` (array, required): Steps to add:
  - `type` (required): `'Given'` | `'When'` | `'Then'`.
  - `pattern` (string, required): Gherkin pattern with `{string}`, `{int}`, `{float}` placeholders.
  - `body` (string, optional): Function body (e.g., `"await this.page.click('button');"`). If omitted, a stub is generated.

**Output:**
```json
{
  "path": "step-definitions/web.steps.ts",
  "content": "import { Given, When, Then } from '@cucumber/cucumber';\nimport type { ConductorWorld } from 'conductor-e2e';\n\nWhen('I click {string}', async function (this: ConductorWorld, label: string) {\n  // TODO: implement\n});\n\nThen('I should see {string}', async function (this: ConductorWorld, text: string) {\n  // TODO: implement\n});"
}
```

**Notes:**
- If the file exists, only adds steps whose pattern is not already present (idempotent).
- Infers TypeScript parameter types from `{string}` / `{int}` / `{float}` in the pattern.
- Use `overwrite: true` to replace the entire file.

---

#### `scaffold_page_object`

**Input:**
- `name` (string, required): Class name (becomes `pages/<Name>Page.ts`, e.g., `LoginPage`).
- `locators` (array, required): Locator definitions:
  - `name` (string): Locator variable name.
  - `selector` (string): Playwright selector.
- `methods` (array, required): Method stubs:
  - `name` (string): Method name.
  - `signature` (string): Full signature including return type, e.g., `async login(username: string, password: string): Promise<void>`.

**Output:**
```json
{
  "path": "pages/LoginPage.ts",
  "content": "import type { Page } from 'playwright';\nimport { BasePage } from 'conductor-e2e';\nimport type { EnvironmentConfig } from 'conductor-e2e';\n\nexport class LoginPage extends BasePage {\n  private readonly usernameInput = this.page.locator('input[name=\"username\"]');\n  private readonly passwordInput = this.page.locator('input[name=\"password\"]');\n  private readonly submitButton = this.page.locator('button[type=\"submit\"]');\n\n  constructor(page: Page, config: EnvironmentConfig) {\n    super(page, config);\n  }\n\n  async login(username: string, password: string): Promise<void> {\n    // TODO: implement\n  }\n}"
}
```

**Notes:**
- Extends `BasePage` and respects Conductor conventions.
- Refuses to overwrite unless you pass `overwrite: true`.

---

#### `scaffold_maestro_flow`

**Input:**
- `name` (string, required): Flow name (becomes `flows/mobile/<name>.yaml`).
- `appId` (string, required): App ID or bundle name (e.g., `com.example.todoapp`).
- `steps` (array, required): Flow steps. Each step must have a valid Maestro command:
  - `launchApp`, `tapOn`, `inputText`, `assertVisible`, `assertNotVisible`, `scroll`, `swipe`, `wait`, `close`, etc.

**Output:**
```json
{
  "path": "flows/mobile/create-todo.yaml",
  "content": "appId: com.example.todoapp\nsteps:\n  - launchApp\n  - tapOn:\n      point:\n        x: 100\n        y: 200\n  - inputText: ${TODO_TITLE}\n  - assertVisible:\n      text: Todo created"
}
```

**Notes:**
- Commands are validated against Maestro's known command list. Unknown commands return a warning.
- Supports `${VAR}` placeholders (env vars passed via `MaestroDriver` when the flow is invoked).

---

### Validation Tools

#### `dry_run_scenario`

**Input:**
- `featurePath` (optional): Run only this feature file (e.g., `'features/web/login.feature'`).
- `scenarioName` (optional): Run only a scenario by name.
- `tag` (optional): Run only scenarios with this tag (e.g., `'@web'`, `'@smoke'`).

**Output:**
```json
{
  "scenarios": 3,
  "steps": {
    "total": 12,
    "passed": 10,
    "undefined": [
      {
        "pattern": "I reset the password",
        "suggestion": "Run: scaffold_step_def({ platform: 'web', pattern: 'I reset the password', ... })"
      }
    ],
    "pending": 0,
    "failed": 0
  }
}
```

**Example:** After scaffolding a new feature file with steps, call `dry_run_scenario` to see which steps are undefined and need to be implemented.

---

## Requirements

- Node ≥ 18
- `conductor-e2e` installed in the target project (required for existing-project discovery tools; `init_project` installs it automatically)
- For mobile tests: Maestro CLI installed separately (see [User Guide prerequisites](../docs/USER_GUIDE.md#1-prerequisites))
- For web tests: Playwright browsers installed (the generated `cucumber.js` includes the `npx playwright install` step)

## Notes

- The MCP server starts in **uninitialized mode** if no `cucumber.js` is found — discovery and validation tools return a helpful error, but `init_project` is still callable.
- After calling `init_project`, you must run `npm install` and **restart the MCP server** (so the server picks up the new `cucumber.js` and can resolve the project context).
- The server re-reads the file system on each tool call (no file watchers in v1) — changes are visible immediately without restarting.

## Resources

- [conductor-e2e on npm](https://www.npmjs.com/package/conductor-e2e)
- [User Guide](../docs/USER_GUIDE.md) — full walkthrough of writing and running tests
- [Repository](https://github.com/nouhouari/conductor)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

[MIT](../LICENSE)
