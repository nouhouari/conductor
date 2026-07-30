/**
 * Java project resolution for the MCP server.
 *
 * A Conductor *TypeScript* project is keyed by cucumber.js. A Conductor *Java*
 * project has no such single marker, so it is identified as a Maven module
 * (pom.xml) whose `src/test/java` tree contains Cucumber-JVM glue — i.e. at
 * least one `@Given`/`@When`/`@Then` annotation or a JUnit `@Suite` class that
 * includes the cucumber engine.
 *
 * Everything a Java project needs that cucumber.js supplies on the TS side —
 * where the features live, where the glue lives, where the Maestro flows live —
 * is read back out of the project itself: `@ConfigurationParameter(key =
 * FEATURES_PROPERTY_NAME, ...)` on the suite classes and the YAML config under
 * `src/test/resources/config/`.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

/** Directories never worth descending into when hunting for a Maven module. */
const SKIP_DIRS = new Set([
  'node_modules',
  'target',
  'build',
  'dist',
  '.git',
  '.idea',
  '.mvn',
  'allure-results',
  'reports',
]);

/** Detected layout of a Conductor Java (Maven) project. */
export interface JavaProjectLayout {
  readonly module: string;
  readonly testJavaRoot: string;
  readonly stepDefinitions: string;
  readonly pages: string;
  readonly features: string;
  readonly flows: string | null;
  readonly basePackage: string;
  /** Glue packages declared by the suite classes (for the Cucumber CLI). */
  readonly gluePackages: readonly string[];
  readonly webBaseUrl: string | null;
  readonly apiBaseUrl: string | null;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/** Recursively collect files with the given extension, skipping build output. */
export async function walkJavaFiles(dir: string, ext = '.java'): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...(await walkJavaFiles(full, ext)));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

/** Cucumber-JVM step annotations, e.g. `@Given("I open {string}")`. */
const JAVA_STEP_ANNOTATION = /@(Given|When|Then)\s*\(/;

/** Does this module's src/test/java contain Cucumber-JVM glue? */
async function hasCucumberGlue(moduleDir: string): Promise<boolean> {
  const testJava = path.join(moduleDir, 'src', 'test', 'java');
  if (!(await isDirectory(testJava))) return false;

  const files = await walkJavaFiles(testJava);
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      if (JAVA_STEP_ANNOTATION.test(content) || content.includes('IncludeEngines("cucumber")')) {
        return true;
      }
    } catch {
      // Unreadable file — keep looking
    }
  }
  return false;
}

/** A Maven module directory that carries Cucumber-JVM glue. */
async function isJavaProject(dir: string): Promise<boolean> {
  return (await exists(path.join(dir, 'pom.xml'))) && (await hasCucumberGlue(dir));
}

/** Walk up from startDir looking for a Conductor Java module. */
export async function findJavaProjectUp(
  startDir: string,
  maxDepth: number,
): Promise<string | null> {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < maxDepth; depth++) {
    if (await isJavaProject(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Walk down from startDir (two levels — enough for `repo/java/module`) looking
 * for a Conductor Java module. Reactor aggregators have no glue of their own,
 * so their modules are inspected too.
 */
export async function findJavaProjectDown(
  startDir: string,
  maxDepth = 2,
): Promise<string | null> {
  const start = path.resolve(startDir);
  if (maxDepth <= 0) return null;

  let entries;
  try {
    entries = await fs.readdir(start, { withFileTypes: true });
  } catch {
    return null;
  }

  const dirs = entries
    .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
    .map((e) => path.join(start, e.name));

  for (const dir of dirs) {
    if (await isJavaProject(dir)) return dir;
  }
  for (const dir of dirs) {
    const nested = await findJavaProjectDown(dir, maxDepth - 1);
    if (nested !== null) return nested;
  }
  return null;
}

/**
 * `@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, value = "path")` — the
 * Java equivalent of cucumber.js's `paths`.
 */
const FEATURES_PARAM =
  /FEATURES_PROPERTY_NAME\s*,\s*value\s*=\s*"([^"]+)"/;

/** `@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "pkg1,pkg2")`. */
const GLUE_PARAM = /GLUE_PROPERTY_NAME\s*,\s*\r?\n?\s*value\s*=\s*"([^"]+)"/;

/** Longest common directory prefix of the given absolute paths. */
function commonAncestor(dirs: string[]): string | null {
  if (dirs.length === 0) return null;
  const split = dirs.map((d) => d.split(path.sep));
  const first = split[0] ?? [];
  const shared: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const segment = first[i];
    if (split.every((parts) => parts[i] === segment)) {
      shared.push(segment as string);
    } else {
      break;
    }
  }
  const joined = shared.join(path.sep);
  return joined.length > 0 ? joined : null;
}

/** Resolve the features directory from the project's JUnit suite classes. */
async function resolveFeaturesDir(moduleDir: string): Promise<string> {
  const testJava = path.join(moduleDir, 'src', 'test', 'java');
  const files = await walkJavaFiles(testJava);
  const declared: string[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const match = FEATURES_PARAM.exec(content);
      if (match?.[1]) {
        declared.push(path.resolve(moduleDir, match[1]));
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Suites usually declare per-platform subdirs (features/web, features/api) —
  // their common ancestor is the features root the tools want to list.
  const ancestor = commonAncestor(declared);
  if (ancestor !== null && (await isDirectory(ancestor))) return ancestor;
  if (declared[0] !== undefined && (await isDirectory(declared[0]))) return declared[0];

  for (const candidate of [
    path.join(moduleDir, 'src', 'test', 'resources', 'features'),
    path.join(moduleDir, 'features'),
  ]) {
    if (await isDirectory(candidate)) return candidate;
  }
  return path.join(moduleDir, 'src', 'test', 'resources', 'features');
}

/**
 * Find the package directory holding the step-definition glue, plus the
 * matching page-object directory. Falls back to src/test/java itself.
 */
async function resolveGlueDirs(
  moduleDir: string,
): Promise<{ stepDefinitions: string; pages: string; basePackage: string }> {
  const testJava = path.join(moduleDir, 'src', 'test', 'java');
  const files = await walkJavaFiles(testJava);

  const stepFiles: string[] = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      if (JAVA_STEP_ANNOTATION.test(content)) stepFiles.push(path.dirname(file));
    } catch {
      // Skip
    }
  }

  const stepDefinitions =
    commonAncestor(stepFiles) ??
    (await firstExistingNamedDir(testJava, ['stepdefs', 'steps', 'stepdefinitions'])) ??
    testJava;

  const pages =
    (await firstExistingNamedDir(testJava, ['pages', 'pageobjects'])) ??
    path.join(path.dirname(stepDefinitions), 'pages');

  // The glue package is the step-def dir relative to src/test/java, dotted.
  const relative = path.relative(testJava, stepDefinitions);
  const basePackage = relative === '' ? '' : relative.split(path.sep).join('.');

  return { stepDefinitions, pages, basePackage };
}

/** Depth-first search for a directory with one of the given names. */
async function firstExistingNamedDir(
  root: string,
  names: readonly string[],
): Promise<string | null> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    if (names.includes(entry.name)) return path.join(root, entry.name);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const nested = await firstExistingNamedDir(path.join(root, entry.name), names);
    if (nested !== null) return nested;
  }
  return null;
}

interface ConductorYamlConfig {
  web?: { baseUrl?: string };
  api?: { baseUrl?: string };
  mobile?: { flowsDir?: string };
}

/**
 * Read the project's YAML config (ConfigLoader precedence: default.yml, then
 * local-overrides.yml, then ${TEST_ENV}.yml) from src/test/resources/config.
 * Maven resource filtering substitutes `${project.basedir}` at build time — we
 * do the same substitution here so paths resolve against the source tree.
 */
async function readJavaConfig(moduleDir: string): Promise<ConductorYamlConfig> {
  const configDir = path.join(moduleDir, 'src', 'test', 'resources', 'config');
  const testEnv = process.env['TEST_ENV'];
  const candidates = ['default.yml', 'local-overrides.yml', ...(testEnv ? [`${testEnv}.yml`] : [])];

  const merged: ConductorYamlConfig = {};
  for (const name of candidates) {
    const file = path.join(configDir, name);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const substituted = raw.replace(/\$\{project\.basedir\}/g, moduleDir);
      const parsed = yaml.load(substituted) as ConductorYamlConfig | undefined;
      if (parsed && typeof parsed === 'object') {
        merged.web = { ...merged.web, ...parsed.web };
        merged.api = { ...merged.api, ...parsed.api };
        merged.mobile = { ...merged.mobile, ...parsed.mobile };
      }
    } catch {
      // Missing/!parseable overlay — ConfigLoader tolerates it, so do we
    }
  }
  return merged;
}

/**
 * Glue packages declared by the suite classes. Cucumber needs these to find
 * both the project's own step definitions and the framework's hooks.
 */
async function resolveGluePackages(moduleDir: string, basePackage: string): Promise<string[]> {
  const testJava = path.join(moduleDir, 'src', 'test', 'java');
  const files = await walkJavaFiles(testJava);
  const packages = new Set<string>();

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const match = GLUE_PARAM.exec(content);
      if (!match?.[1]) continue;
      for (const pkg of match[1].split(',')) {
        const trimmed = pkg.trim();
        if (trimmed.length > 0) packages.add(trimmed);
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (packages.size === 0) {
    packages.add('com.nouhouari.conductor.hooks');
    if (basePackage.length > 0) packages.add(basePackage);
  }
  return [...packages];
}

/**
 * Java package name for a directory inside a module's src/test/java tree.
 * Returns '' for the tree root (default package) or for paths outside it.
 */
export function javaPackageForDir(moduleDir: string, dir: string): string {
  const testJava = path.join(moduleDir, 'src', 'test', 'java');
  const relative = path.relative(testJava, dir);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return relative.split(path.sep).join('.');
}

/** Resolve the full layout of a detected Conductor Java module. */
export async function resolveJavaLayout(moduleDir: string): Promise<JavaProjectLayout> {
  const [features, glue, config] = await Promise.all([
    resolveFeaturesDir(moduleDir),
    resolveGlueDirs(moduleDir),
    readJavaConfig(moduleDir),
  ]);

  const flowsDir = config.mobile?.flowsDir ?? null;

  return {
    module: moduleDir,
    testJavaRoot: path.join(moduleDir, 'src', 'test', 'java'),
    stepDefinitions: glue.stepDefinitions,
    pages: glue.pages,
    features,
    flows: flowsDir === null ? null : path.resolve(moduleDir, flowsDir),
    basePackage: glue.basePackage,
    gluePackages: await resolveGluePackages(moduleDir, glue.basePackage),
    webBaseUrl: config.web?.baseUrl ?? null,
    apiBaseUrl: config.api?.baseUrl ?? null,
  };
}
