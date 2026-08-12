# conductor-mcp

**Model Context Protocol server for AI-assisted E2E test authoring with Conductor.** Let AI assistants (GitHub Copilot CLI, Claude Code, Cursor, Continue) bootstrap Conductor test projects and write scenarios without leaving your editor.

## What It Does

`conductor-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server (stdio) that gives AI assistants a **structured tool surface** to work with the [conductor-e2e](https://github.com/nouhouari/conductor) multi-platform E2E test framework.

With 18 tools across discovery, scaffolding, validation, and live JavaFX desktop introspection, it supports two workflows. Target projects can be **TypeScript** (cucumber-js) or **Java** (Maven + Cucumber-JVM, JDK 17+) — every tool works with either:

1. **Fresh project**: "Set up an E2E test project for web + API" → AI calls `init_project` once → you run `npm install` → have a dry-run-green project.
2. **Existing project**: "Add an E2E test for the password reset flow" → AI discovers existing steps and page objects → scaffolds new artifacts → validates without touching unrelated code.

## Install

`conductor-mcp` is published to **GitHub Packages** (not the public npm registry) as
`@nouhouari/conductor-mcp` by the `release-mcp.yml` workflow, on every `mcp-v*` tag.
Each release also attaches a `.tgz` tarball to the corresponding
[GitHub Release](https://github.com/nouhouari/conductor/releases).

Point the `@nouhouari` scope at GitHub Packages first — add to `.npmrc` (project or `~/.npmrc`):

```ini
@nouhouari:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` must be a personal access token with the `read:packages` scope
(GitHub Packages requires authentication even for public packages).

Then:

```bash
npm install @nouhouari/conductor-mcp
```

Or install straight from a release tarball, with no registry configuration:

```bash
npm install https://github.com/nouhouari/conductor/releases/download/mcp-v0.2.0/nouhouari-conductor-mcp-0.2.0.tgz
```

### Prerequisites

| For | Requirement |
|---|---|
| The MCP server itself | Node ≥ 18 |
| TypeScript target projects | `@nouhouari/conductor-e2e` (`init_project` pins it for new projects) |
| Java target projects | **JDK 17+** (`maven.compiler.release` is `17`) and Maven 3.9+ on `PATH` |

## Wire Up

### GitHub Copilot CLI

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "conductor": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@nouhouari/conductor-mcp"],
      "tools": ["*"]
    }
  }
}
```

Restart the CLI (or run `/mcp` to reload). Copilot requires the explicit `"type": "stdio"`
and a `"tools"` allow-list — `["*"]` enables all 18 tools.

If you installed the package globally (`npm install -g @nouhouari/conductor-mcp`), you can
point straight at the shipped `conductor-mcp` bin instead of going through `npx`:

```json
{
  "mcpServers": {
    "conductor": {
      "type": "stdio",
      "command": "conductor-mcp",
      "args": [],
      "tools": ["*"]
    }
  }
}
```

> The server resolves the target project from the CLI's working directory, so start Copilot
> from inside the Conductor project you want to work on (TypeScript or Java — both are detected).

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["-y", "@nouhouari/conductor-mcp"]
    }
  }
}
```

Restart Claude Code. The **Conductor MCP** tools will be available to any AI in that workspace.

> `npx` resolves `@nouhouari/conductor-mcp` from GitHub Packages, so the `.npmrc` scope
> mapping above must be in place (or the package installed locally, in which case you can use
> `"command": "node", "args": ["./node_modules/@nouhouari/conductor-mcp/dist/cli.js"]`).

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
        "args": ["-y", "@nouhouari/conductor-mcp"]
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

For a Java project, say *"…using Conductor with Java"* instead: the AI passes `language: 'java'`,
and step 2 becomes `mvn test-compile` (JDK 17+ and Maven required) — see [Java Projects](#java-projects).

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
| `get_conductor_api` | Get markdown reference for ConductorWorld, drivers, and BasePage (TypeScript or Java, matching the detected project) |
| `get_config` | Return the resolved environment config and active env vars |

### Scaffolding (6 tools)

| Tool | Purpose |
|---|---|
| `init_project` | Bootstrap a brand-new test project from scratch |
| `scaffold_feature` | Create a new Gherkin feature file with the right platform tag |
| `scaffold_step_def` | Create or append step definitions in idiomatic TypeScript or Java |
| `scaffold_page_object` | Create a page object class extending BasePage |
| `scaffold_maestro_flow` | Create a Maestro YAML flow for mobile testing |
| `remove_samples` | Delete the placeholder sample files written by `init_project` (only unmodified ones, unless `force`) |

### Validation (1 tool)

| Tool | Purpose |
|---|---|
| `dry_run_scenario` | Run a Cucumber dry-run (`cucumber-js`, or Cucumber-JVM for Java) and report undefined steps |

### Desktop Introspection — JavaFX (5 tools)

These talk to a **running** JavaFX app instrumented with `-javaagent:fxagent.jar` (default port
4567). They are live-UI tools, independent of the target project's language.

| Tool | Purpose |
|---|---|
| `explore_desktop_ui` | Dump the live scene-graph tree (types, `#id`, `.styleClass`, text, bounds) |
| `query_desktop_elements` | Find elements by selector (`#id`, `.class`, `text=`, `text~=`, `TypeName`, `css=`, `ref=`, chained with `>>`) |
| `perform_desktop_action` | `click`, `dblclick`, `rightclick`, `hover`, `fill`, `clear`, `select`, `focus`, `scroll`, `setText` |
| `wait_for_desktop_element` | Wait for `exists` / `visible` / `hidden` / `enabled` / `disabled` |
| `take_desktop_screenshot` | Capture the window or one element (inline PNG, or saved to `savePath`) |

## Java Projects

Conductor ships both a TypeScript implementation and a Java (Maven + Cucumber-JVM) port, and
every tool works with either. The server detects the language automatically:

| Language | Marker |
|---|---|
| TypeScript | a `cucumber.js` at the project root |
| Java | a `pom.xml` whose `src/test/java` contains `@Given`/`@When`/`@Then` glue or a JUnit `@Suite` with `@IncludeEngines("cucumber")` |

When both are found while searching upwards, the **closest** one to the current directory wins —
so a Java module nested inside a repo whose root has a `cucumber.js` still resolves as Java.
Pass `projectPath` on any tool call to be explicit.

For a Java project the server reads the layout back out of the project itself:

- **features** — from `@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, ...)` on the suite
  classes (the common ancestor of all declared paths), falling back to `src/test/resources/features`.
- **glue / step definitions** — the package containing the annotated step methods.
- **page objects** — the `pages` package.
- **config** — `src/test/resources/config/default.yml` plus the `${TEST_ENV}.yml` overlay, with
  `${project.basedir}` substituted. Environment variables still take precedence.

What changes per tool:

| Tool | Java behaviour |
|---|---|
| `list_steps` | Parses `@Given`/`@When`/`@Then` annotations in `*.java`. |
| `list_page_objects` | Parses Java classes and their `public`/`protected` method signatures. |
| `scaffold_step_def` | Writes `<Name>Steps.java` into the glue package — an annotated class with `ConductorWorld` constructor injection. Method names are derived from the pattern. |
| `scaffold_page_object` | Writes `<Name>Page.java` extending `BasePage`, with `Locator` fields and a `(Page, EnvironmentConfig)` constructor. Write `signature` in Java, e.g. `void login(String email, String password)`. |
| `dry_run_scenario` | Runs `mvn test-compile`, resolves the test classpath, then runs Cucumber-JVM's CLI in dry-run mode. Slower than the TypeScript path — expect a Maven build. |
| `get_conductor_api` | Returns the Java API reference (synchronous API, `world.page()` accessors, JUnit Platform suites). |
| `init_project` | Pass `language: "java"` to generate a Maven project: `pom.xml`, JUnit Platform suite classes, YAML config, Java step definitions and page objects. |

### Java toolchain & versions

`init_project --language java` generates a `pom.xml` whose versions mirror the framework's own
`java/pom.xml`:

| Component | Version |
|---|---|
| Java (`maven.compiler.release`) | **17** (JDK 17+ required; newer JDKs work, bytecode targets 17) |
| Maven | 3.9+ recommended (any version supporting `maven-compiler-plugin` 3.13.0) |
| Cucumber-JVM (`cucumber-java`, `cucumber-picocontainer`, `cucumber-junit-platform-engine`) | 7.18.1 |
| JUnit Jupiter | 5.10.3 |
| JUnit Platform Suite | 1.10.3 |
| Allure (`allure-cucumber7-jvm`) | 2.29.0 |
| AssertJ | 3.26.3 |
| maven-compiler-plugin / maven-surefire-plugin | 3.13.0 / 3.2.5 |
| Conductor core | `com.nouhouari.conductor:conductor-core:0.1.0-SNAPSHOT` |

> `conductor-core` is **not yet published to a Maven registry** — only the npm packages have a
> release workflow. Until then, install it into your local repository from a clone of this repo:
>
> ```bash
> cd java && mvn install    # builds conductor-core + conductor-example, runs unit tests
> ```

Dependency injection into step classes uses **PicoContainer** (`cucumber-picocontainer`), which is
why generated step classes take `ConductorWorld` as a constructor parameter.

`dry_run_scenario` uses `./mvnw` when the project (or its parent) ships a wrapper, otherwise `mvn`
from `PATH`.

Java-only `init_project` inputs:

- `groupId` (default `com.example`)
- `artifactId` (default: kebab-case of `name`)
- `basePackage` (default: `<groupId>.<artifactId as a Java identifier>`)

Generated layout:

```
pom.xml
src/test/java/<basePackage>/stepdefs/     # @Given/@When/@Then glue
src/test/java/<basePackage>/pages/        # page objects extending BasePage
src/test/java/<basePackage>/suites/       # JUnit Platform @Suite classes (one per platform)
src/test/resources/features/              # .feature files
src/test/resources/config/default.yml     # + <TEST_ENV>.yml overlay
```

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
- `name` (string, required): Project name (used in `package.json` / `pom.xml` and README).
- `language` (optional, default `'typescript'`): `'typescript'` (npm + cucumber-js) or `'java'` (Maven + Cucumber-JVM, JDK 17+).
- `platforms` (array of `'web'` | `'api'` | `'mobile'` | `'desktop'` | `'flutter-desktop'` | `'cross-platform'`, required): Which platforms to configure.
- `groupId` / `artifactId` / `basePackage` (optional, Java only): Maven coordinates and base Java package.
- `webBaseUrl` (string, optional): URL of the web app under test; replaces the default in `.env.example` / config.
- `includeSamples` (boolean, optional, default `false`): Write starter feature + step-def + page/flow files that pass dry-run.
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
- Does **not** run `npm install` (or `mvn`) — that's your step.
- The generated `package.json` pins `@nouhouari/conductor-e2e`, which lives on **GitHub Packages** — the target project needs the `@nouhouari:registry` mapping from [Install](#install).
- With `language: 'java'` it writes `pom.xml` + JUnit Platform suites instead; run `mvn test-compile` to verify.
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

- Node ≥ 18 (the MCP server itself)
- For TypeScript projects: `@nouhouari/conductor-e2e` installed in the target project (required for existing-project discovery tools; `init_project` pins it in the generated `package.json`)
- For Java projects: **JDK 17+** and Maven on `PATH` (`dry_run_scenario` runs `./mvnw` or `mvn`)
- For mobile tests: Maestro CLI installed separately (see [User Guide prerequisites](../docs/USER_GUIDE.md#1-prerequisites))
- For web tests: Playwright browsers installed (the generated `cucumber.js` includes the `npx playwright install` step)
- For JavaFX desktop introspection tools: the app under test started with `-javaagent:fxagent.jar` (default port 4567)

## Notes

- The MCP server starts in **uninitialized mode** if neither a `cucumber.js` (TypeScript) nor a Cucumber-JVM `pom.xml` (Java) is found — discovery and validation tools return a helpful error, but `init_project` is still callable.
- After calling `init_project`, you must run `npm install` and **restart the MCP server** (so the server picks up the new `cucumber.js` and can resolve the project context).
- The server re-reads the file system on each tool call (no file watchers in v1) — changes are visible immediately without restarting.

## Resources

- [@nouhouari/conductor-e2e on GitHub Packages](https://github.com/nouhouari/conductor/pkgs/npm/conductor-e2e)
- [@nouhouari/conductor-mcp on GitHub Packages](https://github.com/nouhouari/conductor/pkgs/npm/conductor-mcp)
- [Releases](https://github.com/nouhouari/conductor/releases) — downloadable `.tgz` tarballs
- [User Guide](../docs/USER_GUIDE.md) — full walkthrough of writing and running tests
- [Repository](https://github.com/nouhouari/conductor)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

[MIT](../LICENSE)
