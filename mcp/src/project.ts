/**
 * ProjectContext resolves the Conductor project root and configuration.
 *
 * Resolution order:
 * 1. Explicit `projectPath` override (caller-supplied) — used as the root directly.
 * 2. Walk UP from cwd looking for cucumber.js (max 4 levels).
 * 3. Walk DOWN one level — check common subdirectories (tests, test, e2e,
 *    e2e-conductor, e2e-tests, qa) for cucumber.js. This handles monorepos where
 *    the MCP server is rooted at the repo root but the Conductor project lives
 *    in a subdir.
 * 4. If still not found, isInitialized = false — discovery/validation tools
 *    surface a clear error directing the AI to init_project or to pass projectPath.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  findJavaProjectDown,
  findJavaProjectUp,
  resolveJavaLayout,
} from './java-project.js';

/** Implementation language of the resolved Conductor project. */
export type ProjectLanguage = 'typescript' | 'java';

/** Canonical directory layout for a Conductor consumer project. */
export interface ProjectPaths {
  readonly root: string;
  readonly features: string;
  readonly stepDefinitions: string;
  readonly pages: string;
  readonly flows: string;
  /**
   * Which implementation the project uses. TypeScript projects are keyed by
   * cucumber.js; Java projects by a Maven module with src/test/java glue.
   */
  readonly language: ProjectLanguage;
  /**
   * Java only: the Maven module directory holding src/test/java (equal to
   * `root` for a single-module project, a subdirectory for a reactor build),
   * and the base package of the step-definition glue.
   */
  readonly javaModule?: string;
  readonly javaBasePackage?: string;
  /** Java only: glue packages declared by the suite classes. */
  readonly javaGluePackages?: readonly string[];
}

/**
 * Minimal config shape we care about at the MCP server level.
 * We read this from the project's config if available, otherwise use defaults.
 */
export interface ResolvedConfig {
  readonly name: string;
  readonly webBaseUrl: string;
  readonly apiBaseUrl: string;
  readonly flowsDir: string;
  readonly envVarsSet: Record<string, string | undefined>;
}

/** Result of resolving a project context. */
export type ProjectContextResult =
  | { readonly isInitialized: true; readonly paths: ProjectPaths; readonly config: ResolvedConfig }
  | { readonly isInitialized: false; readonly cwd: string };

const SEARCH_DEPTH = 4;

/** Check whether a file exists at the given path. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk from cwd upward looking for cucumber.js.
 * Returns the directory containing cucumber.js, or null if not found.
 */
async function findProjectRootUp(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < SEARCH_DEPTH; depth++) {
    const candidate = path.join(current, 'cucumber.js');
    if (await fileExists(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }
  return null;
}

/** Subdirectory names commonly used for E2E test projects in monorepos. */
const DOWNWARD_CANDIDATES = [
  'tests',
  'test',
  'e2e',
  'e2e-conductor',
  'e2e-tests',
  'integration-tests',
  'qa',
];

/**
 * Walk DOWN one level from startDir looking for cucumber.js in known
 * subdirectory names, then in any other immediate subdirs (skipping
 * node_modules, dist, build, .git). Returns the first matching directory.
 */
async function findProjectRootDown(startDir: string): Promise<string | null> {
  const start = path.resolve(startDir);

  // First pass: known candidate names — these are fast and cover the common cases.
  for (const candidate of DOWNWARD_CANDIDATES) {
    const candidateDir = path.join(start, candidate);
    if (await fileExists(path.join(candidateDir, 'cucumber.js'))) {
      return candidateDir;
    }
  }

  // Second pass: any other immediate subdir with a cucumber.js.
  let entries: string[];
  try {
    const direntList = await fs.readdir(start, { withFileTypes: true });
    entries = direntList
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter(
        (n) =>
          !DOWNWARD_CANDIDATES.includes(n) &&
          n !== 'node_modules' &&
          n !== 'dist' &&
          n !== 'build' &&
          n !== '.git' &&
          !n.startsWith('.'),
      );
  } catch {
    return null;
  }

  for (const entry of entries) {
    const candidateDir = path.join(start, entry);
    if (await fileExists(path.join(candidateDir, 'cucumber.js'))) {
      return candidateDir;
    }
  }

  return null;
}

/**
 * Extract flowsDir value from cucumber.js content using simple regex heuristics.
 * Falls back to 'flows/mobile' if not found.
 */
function extractFlowsDirFromCucumberJs(cucumberJsContent: string): string {
  // Look for flowsDir: 'some/path' or flowsDir: "some/path"
  const match = /flowsDir\s*:\s*['"]([^'"]+)['"]/m.exec(cucumberJsContent);
  return match?.[1] ?? 'flows/mobile';
}

/**
 * Build the resolved config from env vars and defaults.
 * The MCP server does NOT import conductor-e2e at runtime, so we reconstruct
 * the config from env vars and sensible defaults.
 */
function buildResolvedConfig(projectRoot: string, flowsDir: string): ResolvedConfig {
  const relevantEnvVars = [
    'TEST_ENV',
    'WEB_BASE_URL',
    'API_BASE_URL',
    'HEADLESS',
    'BROWSER',
    'MAESTRO_DEVICE',
    'DEBUG_MAESTRO',
    'DATABASE_URL',
  ];

  const envVarsSet: Record<string, string | undefined> = {};
  for (const key of relevantEnvVars) {
    if (process.env[key] !== undefined) {
      envVarsSet[key] = process.env[key];
    }
  }

  return {
    name: path.basename(projectRoot),
    webBaseUrl: process.env['WEB_BASE_URL'] ?? 'http://localhost:3000',
    apiBaseUrl: process.env['API_BASE_URL'] ?? 'http://localhost:3000/api',
    flowsDir: path.resolve(projectRoot, flowsDir),
    envVarsSet,
  };
}

/**
 * Resolve the project context from a starting directory.
 *
 * TypeScript projects (cucumber.js) win when both are present, since that's the
 * marker the tools historically keyed on. A Maven module carrying Cucumber-JVM
 * glue is resolved as a Java project — see ./java-project.ts.
 *
 * @param cwd          - Fallback starting directory (typically process.cwd()).
 * @param projectPath  - Optional explicit project root. When set, skips the
 *                       up/down search and uses this path directly (after
 *                       verifying it is a TypeScript or Java Conductor
 *                       project). Lets callers (e.g., an AI assistant) point
 *                       the server at the right project in monorepos that
 *                       don't match the heuristics.
 */
export async function resolveProjectContext(
  cwd: string,
  projectPath?: string,
): Promise<ProjectContextResult> {
  let root: string | null = null;

  if (projectPath) {
    const explicit = path.resolve(projectPath);
    if (await fileExists(path.join(explicit, 'cucumber.js'))) {
      root = explicit;
    } else {
      const javaModule = await findJavaProjectUp(explicit, 1);
      if (javaModule !== null) return resolveJavaContext(javaModule);
      return { isInitialized: false, cwd: explicit };
    }
  } else {
    // Both searches walk up from cwd. When a repo has a TypeScript project at
    // its root and a Java module in a subdirectory (this repo, for one), the
    // nearest match must win — otherwise the root cucumber.js shadows the Java
    // module the caller is actually sitting in. A longer path is a deeper, and
    // therefore closer, ancestor.
    const tsRoot = await findProjectRootUp(cwd);
    const javaRoot = await findJavaProjectUp(cwd, SEARCH_DEPTH);

    if (tsRoot !== null && javaRoot !== null) {
      if (javaRoot.length > tsRoot.length) return resolveJavaContext(javaRoot);
      root = tsRoot;
    } else if (javaRoot !== null) {
      return resolveJavaContext(javaRoot);
    } else {
      root = tsRoot ?? (await findProjectRootDown(cwd));
      if (root === null) {
        const nested = await findJavaProjectDown(cwd);
        if (nested !== null) return resolveJavaContext(nested);
      }
    }
  }

  if (root === null) {
    return { isInitialized: false, cwd: path.resolve(cwd) };
  }

  // Try to read cucumber.js to extract flowsDir
  let flowsDir = 'flows/mobile';
  try {
    const cucumberJsPath = path.join(root, 'cucumber.js');
    const content = await fs.readFile(cucumberJsPath, 'utf8');
    flowsDir = extractFlowsDirFromCucumberJs(content);
  } catch {
    // Use default if reading fails
  }

  const paths: ProjectPaths = {
    root,
    features: path.join(root, 'features'),
    stepDefinitions: path.join(root, 'step-definitions'),
    pages: path.join(root, 'pages'),
    flows: path.join(root, flowsDir),
    language: 'typescript',
  };

  const config = buildResolvedConfig(root, flowsDir);

  return { isInitialized: true, paths, config };
}

/** Build the context for a detected Conductor Java (Maven) module. */
async function resolveJavaContext(moduleDir: string): Promise<ProjectContextResult> {
  const layout = await resolveJavaLayout(moduleDir);

  const paths: ProjectPaths = {
    root: layout.module,
    features: layout.features,
    stepDefinitions: layout.stepDefinitions,
    pages: layout.pages,
    flows: layout.flows ?? path.join(layout.module, 'flows', 'mobile'),
    language: 'java',
    javaModule: layout.module,
    javaBasePackage: layout.basePackage,
    javaGluePackages: layout.gluePackages,
  };

  const base = buildResolvedConfig(layout.module, paths.flows);

  const config: ResolvedConfig = {
    ...base,
    // YAML config is the Java equivalent of config/environments/*.ts; env vars
    // still win, matching ConfigLoader's precedence.
    webBaseUrl: process.env['WEB_BASE_URL'] ?? layout.webBaseUrl ?? base.webBaseUrl,
    apiBaseUrl: process.env['API_BASE_URL'] ?? layout.apiBaseUrl ?? base.apiBaseUrl,
    flowsDir: paths.flows,
  };

  return { isInitialized: true, paths, config };
}

/** Error message to return when project is not initialized. */
export function notInitializedError(cwd: string): string {
  return (
    `No Conductor project found at or near "${cwd}" — looked for a TypeScript project ` +
    `(cucumber.js) and a Java project (pom.xml with Cucumber-JVM glue under src/test/java), ` +
    `searching ${SEARCH_DEPTH} levels up and down through common subdirs ` +
    `(${DOWNWARD_CANDIDATES.join(', ')}). ` +
    `Either: (1) run init_project to bootstrap a new Conductor project here, ` +
    `(2) pass projectPath="<absolute path>" on this tool call to point the server at an existing project, ` +
    `or (3) restart the MCP server from inside the project root.`
  );
}
