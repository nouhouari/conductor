/**
 * MCP server for conductor-e2e.
 *
 * Registers all 18 tools across four categories:
 * - Discovery (6): list_steps, list_page_objects, list_maestro_flows,
 *                  list_features, get_conductor_api, get_config
 * - Scaffolding (6): init_project, scaffold_feature, scaffold_step_def,
 *                    scaffold_page_object, scaffold_maestro_flow, remove_samples
 * - Validation (1): dry_run_scenario
 * - Desktop (5): explore_desktop_ui, take_desktop_screenshot,
 *                query_desktop_elements, perform_desktop_action,
 *                wait_for_desktop_element
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { resolveProjectContext, notInitializedError } from './project.js';

// Discovery tools
import { listSteps, listStepsInputSchema } from './tools/discovery/list-steps.js';
import { listPageObjects, listPageObjectsInputSchema } from './tools/discovery/list-page-objects.js';
import { listMaestroFlows, listMaestroFlowsInputSchema } from './tools/discovery/list-maestro-flows.js';
import { listFeatures, listFeaturesInputSchema } from './tools/discovery/list-features.js';
import { getConductorApi, getConductorApiInputSchema } from './tools/discovery/get-conductor-api.js';
import { getConfig, getConfigInputSchema } from './tools/discovery/get-config.js';

// Scaffolding tools
import { initProject, initProjectInputSchema } from './tools/scaffolding/init-project.js';
import { scaffoldFeature, scaffoldFeatureInputSchema } from './tools/scaffolding/scaffold-feature.js';
import { scaffoldStepDef, scaffoldStepDefInputSchema } from './tools/scaffolding/scaffold-step-def.js';
import { scaffoldPageObject, scaffoldPageObjectInputSchema } from './tools/scaffolding/scaffold-page-object.js';
import { scaffoldMaestroFlow, scaffoldMaestroFlowInputSchema } from './tools/scaffolding/scaffold-maestro-flow.js';
import { removeSamples, removeSamplesInputSchema } from './tools/scaffolding/remove-samples.js';

// Validation tools
import { dryRunScenario, dryRunScenarioInputSchema } from './tools/validation/dry-run-scenario.js';

// Desktop tools
import { exploreUi, exploreUiInputSchema } from './tools/desktop/explore-ui.js';
import { takeScreenshot, takeScreenshotInputSchema } from './tools/desktop/take-screenshot.js';
import { queryElements, queryElementsInputSchema } from './tools/desktop/query-elements.js';
import { performAction, performActionInputSchema } from './tools/desktop/perform-action.js';
import { waitForElement, waitForElementInputSchema } from './tools/desktop/wait-for-element.js';

/**
 * Creates and configures the MCP server with all 18 tools.
 *
 * @param cwd - Working directory from which to resolve the project context.
 *              Defaults to process.cwd(). Set explicitly in tests.
 */
export function createServer(cwd: string = process.cwd()): McpServer {
  const server = new McpServer({
    name: 'conductor-mcp',
    version: '0.1.0',
  });

  // Resolved per call (cheap; no file watchers in v1). Honors an optional
  // per-call `projectPath` override so callers can point the server at a
  // specific Conductor project regardless of cwd — useful in monorepos.
  async function getContext(projectPath?: string) {
    return resolveProjectContext(cwd, projectPath);
  }

  function toTextContent(data: unknown): { content: [{ type: 'text'; text: string }] } {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  }

  function errorContent(message: string): { content: [{ type: 'text'; text: string }]; isError: true } {
    return {
      content: [{ type: 'text' as const, text: message }],
      isError: true,
    };
  }

  // ─────────────────────────────────────────────────────────
  // DISCOVERY TOOLS
  // ─────────────────────────────────────────────────────────

  server.registerTool(
    'list_steps',
    {
      title: 'List Step Definitions',
      description:
        'Walk the project step definitions and return all registered Cucumber steps. ' +
        'Handles both TypeScript projects (step-definitions/**/*.ts) and Java projects ' +
        '(src/test/java glue with @Given/@When/@Then annotations). ' +
        'Each entry includes the pattern, type (Given/When/Then), file, line number, ' +
        'parameter types, and which feature files use that step.',
      inputSchema: listStepsInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const steps = await listSteps(context.paths, input);
        return toTextContent(steps);
      } catch (err) {
        return errorContent(`list_steps failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'list_page_objects',
    {
      title: 'List Page Objects',
      description:
        'Walk the project page objects (pages/**/*.ts, or the Java pages package) and extract ' +
        'class names, their base class, and public method signatures. ' +
        'Uses a lightweight regex parser — no TypeScript compiler or Java parser required.',
      inputSchema: listPageObjectsInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const pages = await listPageObjects(context.paths, input);
        return toTextContent(pages);
      } catch (err) {
        return errorContent(`list_page_objects failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'list_maestro_flows',
    {
      title: 'List Maestro Flows',
      description:
        'Walk flows/mobile/**/*.yaml and extract flow names, appId, env-var placeholders (${VAR}), and step command names.',
      inputSchema: listMaestroFlowsInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const flows = await listMaestroFlows(context.paths, input);
        return toTextContent(flows);
      } catch (err) {
        return errorContent(`list_maestro_flows failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'list_features',
    {
      title: 'List Feature Files',
      description:
        'Walk features/**/*.feature and return parsed structure: feature name, tags, and scenarios with their steps. ' +
        'Optionally filter by tag.',
      inputSchema: listFeaturesInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const features = await listFeatures(context.paths, input);
        return toTextContent(features);
      } catch (err) {
        return errorContent(`list_features failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'get_conductor_api',
    {
      title: 'Get Conductor API Reference',
      description:
        'Return markdown API reference for the conductor-e2e framework. ' +
        'Covers ConductorWorld, WebDriver, ApiDriver, MaestroDriver, FlutterDesktopDriver, JavaFxDriver, DatabaseDriver, and BasePage. ' +
        'Automatically returns Java docs for Java projects and TypeScript docs otherwise. ' +
        'Use this before writing step definitions or page objects to understand the available API.',
      inputSchema: getConductorApiInputSchema,
    },
    async (input) => {
      try {
        const context = await getContext(input.projectPath);
        const language = context.isInitialized ? context.paths.language : 'typescript';
        const result = getConductorApi(input, language);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`get_conductor_api failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'get_config',
    {
      title: 'Get Project Configuration',
      description:
        'Return the resolved EnvironmentConfig for the current Conductor project, ' +
        'including which environment variables are set and their effect.',
      inputSchema: getConfigInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = getConfig(context);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`get_config failed: ${String(err)}`);
      }
    },
  );

  // ─────────────────────────────────────────────────────────
  // SCAFFOLDING TOOLS
  // ─────────────────────────────────────────────────────────

  server.registerTool(
    'init_project',
    {
      title: 'Bootstrap New Conductor Project',
      description:
        'Bootstrap a brand-new Conductor E2E test project at the given path. ' +
        'Supports five platforms: web (Playwright), api (REST), mobile (Maestro/Flutter), ' +
        'desktop (JavaFX), and cross-platform (one scenario spanning all of the above). ' +
        'Before calling, gather two things from the user: ' +
        '(1) which of the five platforms they want — do not silently default to web/api; ' +
        "ask whether they need desktop (JavaFX) coverage. " +
        '(2) the base URL of the web app under test, if known — pass it as `webBaseUrl` ' +
        'so it ends up in `.env.example`. If the user does not yet have a URL, omit it ' +
        'and leave `includeSamples` at its default of false. ' +
        'Writes package.json, tsconfig.json, cucumber.js, .env.example, .gitignore, ' +
        'README.md, and the directory tree. ' +
        'Pass language="java" to bootstrap a Maven project instead (pom.xml, JUnit Platform suite ' +
        'classes, YAML config under src/test/resources/config, Java step definitions). ' +
        'Only set includeSamples=true if the user explicitly wants a runnable demo — ' +
        'otherwise the placeholder example.feature files show up as undefined scenarios ' +
        'in `npm test`. Real features should come from scaffold_feature / scaffold_step_def ' +
        "for the user's actual scenarios. " +
        'Does NOT run npm install — returns nextSteps with the install commands. ' +
        'Refuses to write if the target directory is non-empty unless force=true.',
      inputSchema: initProjectInputSchema,
    },
    async (input) => {
      try {
        const result = await initProject(input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`init_project failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'scaffold_feature',
    {
      title: 'Scaffold Feature File',
      description:
        'Create a new Cucumber feature file in features/<platform>/<name>.feature. ' +
        'Applies the appropriate platform tag (@web, @api, @mobile, @desktop, @cross-platform). ' +
        'Refuses to overwrite existing files unless overwrite=true.',
      inputSchema: scaffoldFeatureInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = await scaffoldFeature(context.paths, input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`scaffold_feature failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'scaffold_step_def',
    {
      title: 'Scaffold Step Definition File',
      description:
        'Create or append to a step definition file: TypeScript projects get ' +
        'step-definitions/<name>.steps.ts, Java projects get <Name>Steps.java in the glue package. ' +
        'Infers parameter types from {string}, {int}, {float} in patterns. ' +
        'IMPORTANT: when you provide a body that references identifiers (e.g. email, path, expected), also pass paramNames matching ' +
        "those identifiers in placeholder order — otherwise the generated parameters default to value/value2/count and the file won't compile. " +
        'If the file exists, only adds steps whose pattern is not already present (idempotent). ' +
        'Use overwrite=true to fully replace the file.',
      inputSchema: scaffoldStepDefInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = await scaffoldStepDef(context.paths, input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`scaffold_step_def failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'scaffold_page_object',
    {
      title: 'Scaffold Page Object',
      description:
        'Create a page object class extending BasePage — pages/<Name>Page.ts in a TypeScript project, ' +
        '<Name>Page.java in the pages package of a Java project. ' +
        'Generates private Locator fields, a constructor with initializers, and method stubs. ' +
        'Refuses to overwrite unless overwrite=true.',
      inputSchema: scaffoldPageObjectInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = await scaffoldPageObject(context.paths, input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`scaffold_page_object failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'scaffold_maestro_flow',
    {
      title: 'Scaffold Maestro Flow',
      description:
        'Create a Maestro YAML flow file in flows/mobile/<name>.yaml. ' +
        'Steps are validated against known Maestro commands (warning returned for unknown commands). ' +
        'Refuses to overwrite unless overwrite=true.',
      inputSchema: scaffoldMaestroFlowInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = await scaffoldMaestroFlow(context.paths, input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`scaffold_maestro_flow failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'remove_samples',
    {
      title: 'Remove Bootstrap Sample Files',
      description:
        'Delete the placeholder feature/step/page/flow files that init_project ' +
        'wrote with includeSamples=true. Call this once you have scaffolded the ' +
        "real features the user wants — otherwise example.feature shows up as " +
        'undefined scenarios in `npm test`. ' +
        'By default only deletes files whose content is byte-equivalent to the ' +
        'original sample (user edits are preserved). Pass force=true to delete ' +
        'modified copies as well. Optional `platforms` restricts the scope to a ' +
        'subset of the five.',
      inputSchema: removeSamplesInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = await removeSamples(context.paths, input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`remove_samples failed: ${String(err)}`);
      }
    },
  );

  // ─────────────────────────────────────────────────────────
  // VALIDATION TOOLS
  // ─────────────────────────────────────────────────────────

  server.registerTool(
    'dry_run_scenario',
    {
      title: 'Dry-Run Scenarios',
      description:
        'Validate step definitions without executing them. TypeScript projects run ' +
        '`npx cucumber-js --dry-run --format json`; Java projects run `mvn test-compile` and then ' +
        "Cucumber-JVM's CLI in dry-run mode against the resolved test classpath (slower — expect a Maven build). " +
        'Returns the number of scenarios, step counts by status (passed/undefined/pending/failed), ' +
        'and for each undefined step: the pattern and a suggestion (an existing similar step or a scaffold recommendation). ' +
        'Optionally scope to a specific feature file, scenario name, or tag.',
      inputSchema: dryRunScenarioInputSchema,
    },
    async (input) => {
      const context = await getContext(input.projectPath);
      if (!context.isInitialized) {
        return errorContent(notInitializedError(cwd));
      }
      try {
        const result = await dryRunScenario(context.paths, input);
        return toTextContent(result);
      } catch (err) {
        return errorContent(`dry_run_scenario failed: ${String(err)}`);
      }
    },
  );

  // ─────────────────────────────────────────────────────────
  // DESKTOP TOOLS (JavaFX live introspection via fxagent)
  // ─────────────────────────────────────────────────────────

  server.registerTool(
    'explore_desktop_ui',
    {
      title: 'Explore Desktop UI (JavaFX)',
      description:
        'Get the live scene graph tree from a running JavaFX application instrumented with fxagent. ' +
        'Returns an indented text tree showing element types, IDs (#id), CSS classes (.class), ' +
        'text content, visibility, and screen bounds. ' +
        'Optionally scope to a subtree using a selector (e.g. "#main-panel"). ' +
        'The app must be started with -javaagent:fxagent.jar (default port 4567). ' +
        'Use this before writing Cucumber scenarios to understand the real UI structure.',
      inputSchema: exploreUiInputSchema,
    },
    async (input) => {
      try {
        return await exploreUi(input);
      } catch (err) {
        return errorContent(`explore_desktop_ui failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'take_desktop_screenshot',
    {
      title: 'Take Desktop Screenshot (JavaFX)',
      description:
        'Capture a screenshot of a running JavaFX application. ' +
        'Returns the full window by default, or a specific element when selector is given. ' +
        'Without savePath, returns an inline PNG image for the AI to inspect visually. ' +
        'With savePath, saves to disk and returns the file path. ' +
        'The app must be started with -javaagent:fxagent.jar.',
      inputSchema: takeScreenshotInputSchema,
    },
    async (input) => {
      try {
        return await takeScreenshot(input);
      } catch (err) {
        return errorContent(`take_desktop_screenshot failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'query_desktop_elements',
    {
      title: 'Query Desktop Elements (JavaFX)',
      description:
        'Find elements in a running JavaFX app that match a selector. ' +
        'Selector syntax: #id, .styleClass, text=exact, text~=partial, TypeName (e.g. Button), ' +
        'css=selector, ref=<handle>. Chain with >>. ' +
        'Returns element handles, types, IDs, text, style classes, bounds, visibility, and enabled state. ' +
        'Handles from this tool can be reused in perform_desktop_action and wait_for_desktop_element.',
      inputSchema: queryElementsInputSchema,
    },
    async (input) => {
      try {
        return await queryElements(input);
      } catch (err) {
        return errorContent(`query_desktop_elements failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'perform_desktop_action',
    {
      title: 'Perform Desktop Action (JavaFX)',
      description:
        'Execute an action on an element in a running JavaFX application. ' +
        'Actions: click, dblclick, rightclick, hover, fill, clear, select, focus, scroll, setText. ' +
        'fill/select/setText require a "value". ' +
        'Returns success/failure with element confirmation. ' +
        'Use explore_desktop_ui or query_desktop_elements first to discover the selector.',
      inputSchema: performActionInputSchema,
    },
    async (input) => {
      try {
        return await performAction(input);
      } catch (err) {
        return errorContent(`perform_desktop_action failed: ${String(err)}`);
      }
    },
  );

  server.registerTool(
    'wait_for_desktop_element',
    {
      title: 'Wait For Desktop Element (JavaFX)',
      description:
        'Wait until a JavaFX UI element reaches a specified state: ' +
        '"exists" (present in the scene graph), "visible", "hidden" (absent, or present but not visible), ' +
        '"enabled", or "disabled". ' +
        'Polls the agent client-side, so waiting for an element to disappear works even though ' +
        "the agent's own wait endpoint errors when nothing matches. " +
        'Useful after actions that trigger async UI changes (dialogs, loading spinners, navigation). ' +
        'Returns element info when the condition is met, or a timeout message (with the last-seen state) after timeoutMs.',
      inputSchema: waitForElementInputSchema,
    },
    async (input) => {
      try {
        return await waitForElement(input);
      } catch (err) {
        return errorContent(`wait_for_desktop_element failed: ${String(err)}`);
      }
    },
  );

  // Suppress unused variable warning for z (used in inputSchema shapes via zod)
  void z;

  return server;
}
