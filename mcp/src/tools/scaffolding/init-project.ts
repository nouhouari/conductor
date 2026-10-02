/**
 * init_project: Bootstrap a brand-new Conductor test project.
 *
 * Writes the full file tree: package.json, tsconfig.json, cucumber.js,
 * .env.example, .gitignore, README.md, directory structure, and (if
 * includeSamples=true) starter feature + step-def + page/flow files.
 *
 * Does NOT run npm install — returns nextSteps with the install command.
 * Refuses to write if the target directory is non-empty unless force=true.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { renderPackageJson } from '../../templates/project/package-json.js';
import { renderTsConfigJson } from '../../templates/project/tsconfig-json.js';
import { renderCucumberJs } from '../../templates/project/cucumber-js.js';
import { renderEnvExample } from '../../templates/project/env-example.js';
import { renderGitignore } from '../../templates/project/gitignore.js';
import { renderReadme } from '../../templates/project/readme.js';
import { getSamplesForPlatforms } from '../../templates/project/samples.js';
import { renderJavaPom, CONDUCTOR_JAVA_VERSION, CONDUCTOR_MAVEN_REPO_ID } from '../../templates/project/java-pom.js';
import { renderJavaSuite, getJavaSuiteClassName, type JavaSuitePlatform } from '../../templates/project/java-suites.js';
import { renderJavaConfigYml } from '../../templates/project/java-config.js';
import { getJavaSamplesForPlatforms } from '../../templates/project/java-samples.js';
import { renderJavaReadme } from '../../templates/project/java-readme.js';
import { renderJavaGitignore } from '../../templates/project/java-gitignore.js';

const PLATFORM_VALUES = ['web', 'api', 'mobile', 'desktop', 'flutter-desktop', 'cross-platform'] as const;
type Platform = typeof PLATFORM_VALUES[number];

export const initProjectInputSchema = z.object({
  path: z.string().describe("Absolute path to the target directory. Created if it doesn't exist."),
  name: z.string().describe("Project name (used in package.json and README)."),
  language: z
    .enum(['typescript', 'java'])
    .default('typescript')
    .describe(
      "Implementation language to scaffold. Default: 'typescript' (the existing npm/cucumber-js layout). " +
        "'java' writes a Maven/Cucumber-JVM/JUnit Platform project instead.",
    ),
  platforms: z
    .array(z.enum(PLATFORM_VALUES))
    .min(1)
    .describe(
      "Platforms to configure. Pick any combination of: " +
        "'web' (Playwright browser automation), " +
        "'api' (REST testing via Playwright APIRequestContext), " +
        "'mobile' (Flutter / native mobile via Maestro), " +
        "'desktop' (JavaFX desktop apps via javafx-driver / fxagent.jar), " +
        "'flutter-desktop' (Flutter desktop apps via Dart VM service / flutter_driver), " +
        "'cross-platform' (a single scenario that spans browser + API + Maestro + JavaFX). " +
        "Each platform adds a cucumber profile, an npm test script, and (if includeSamples) a starter feature + step-def. " +
        "When the user does not specify, ask which of these six they want — desktop in particular is often missed.",
    ),
  groupId: z
    .string()
    .optional()
    .describe("Java only: Maven groupId. Defaults to 'com.example' when language='java'."),
  artifactId: z
    .string()
    .optional()
    .describe("Java only: Maven artifactId. Defaults to a kebab-case form of name when language='java'."),
  basePackage: z
    .string()
    .optional()
    .describe(
      "Java only: base Java package for generated stepdefs/pages/suites. " +
        "Defaults to '<groupId>.<artifactId as a Java identifier>'.",
    ),
  includeSamples: z
    .boolean()
    .default(false)
    .describe(
      "Write starter feature + step-def + page/flow files. Default: false. " +
        'Only set to true when the user explicitly wants a runnable demo or template — ' +
        'typically alongside a known `webBaseUrl`. When samples are written but never ' +
        'replaced, they show up as undefined-scenario noise in `npm test`. ' +
        'For a clean structure (the common case), leave this at the default and call ' +
        "scaffold_feature/scaffold_step_def for the user's actual scenarios. " +
        'If samples were included on a previous init and you want them gone, call remove_samples.',
    ),
  webBaseUrl: z
    .string()
    .optional()
    .describe(
      'Optional URL of the web application under test (e.g. http://localhost:8080). ' +
        'When provided, it replaces the default http://localhost:3000 in `.env.example` ' +
        'so the user has one less thing to edit. If the user mentions a target URL ' +
        'during setup, capture it here.',
    ),
  force: z
    .boolean()
    .default(false)
    .describe("Overwrite if target directory is non-empty. Default: false."),
});

export type InitProjectInput = z.infer<typeof initProjectInputSchema>;

export interface InitProjectResult {
  readonly path: string;
  readonly files: readonly string[];
  readonly nextSteps: readonly string[];
}

async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.length === 0;
  } catch (err) {
    // Directory doesn't exist yet — treat as empty
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw err;
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function getDirectoriesToCreate(platforms: readonly Platform[]): string[] {
  const dirs = ['step-definitions', 'pages', 'reports'];

  const featureDirs: string[] = ['features'];
  for (const platform of platforms) {
    featureDirs.push(`features/${platform}`);
  }

  if (platforms.includes('mobile') || platforms.includes('cross-platform')) {
    dirs.push('flows/mobile');
  }

  return [...featureDirs, ...dirs];
}

function getJavaDirectoriesToCreate(platforms: readonly Platform[], basePackage: string): string[] {
  const basePath = basePackage.replaceAll('.', '/');
  const dirs = [
    `src/test/java/${basePath}/stepdefs`,
    `src/test/java/${basePath}/pages`,
    `src/test/java/${basePath}/suites`,
    'src/test/resources/features',
    'src/test/resources/config',
    'reports',
  ];

  for (const platform of platforms) {
    dirs.push(`src/test/resources/features/${platform}`);
  }

  if (platforms.includes('mobile') || platforms.includes('cross-platform')) {
    dirs.push('flows/mobile');
  }

  return dirs;
}

function buildNextSteps(projectPath: string, platforms: readonly Platform[]): string[] {
  const steps = [
    `cd ${projectPath}`,
    'npm install',
  ];

  if (platforms.includes('web') || platforms.includes('cross-platform')) {
    steps.push('npx playwright install chromium');
  }

  steps.push(
    'npm run test:dry-run   # validate all step definitions are registered',
    '# Restart the MCP server so it picks up the new cucumber.js',
  );

  return steps;
}

function buildJavaNextSteps(projectPath: string, platforms: readonly Platform[]): string[] {
  const steps = [
    `cd ${projectPath}`,
    `# conductor-core ${CONDUCTOR_JAVA_VERSION} resolves from GitHub Packages, which requires auth:`,
    `# add a <server> with id "${CONDUCTOR_MAVEN_REPO_ID}" and a read:packages token to ~/.m2/settings.xml (see README.md)`,
    'mvn -q install -DskipTests',
  ];

  if (platforms.includes('web') || platforms.includes('cross-platform')) {
    steps.push('mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium"');
  }

  const firstSuite = platforms.length > 0
    ? getJavaSuiteClassName(platforms[0] as JavaSuitePlatform)
    : getJavaSuiteClassName('all');
  steps.push(
    `mvn test -Dtest=${firstSuite}`,
    'mvn test -Dtest=DefaultSuiteTest   # run all local feature files',
    '# Restart the MCP server so it picks up the new Java project layout',
  );

  return steps;
}

function toArtifactId(name: string): string {
  const artifactId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return artifactId || 'conductor-tests';
}

function toPackageSegment(value: string): string {
  const words = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
  const segment = words.join('');
  if (!segment) return 'tests';
  return /^[a-z]/.test(segment) ? segment : `_${segment}`;
}

export async function initProject(input: InitProjectInput): Promise<InitProjectResult> {
  const targetPath = path.resolve(input.path);
  const platforms = input.platforms as Platform[];

  // Safety check: refuse to overwrite non-empty dirs without force
  const isEmpty = await isDirectoryEmpty(targetPath);
  if (!isEmpty && !input.force) {
    throw new Error(
      `Target directory "${targetPath}" is not empty. ` +
      `Pass force: true to overwrite existing files.`,
    );
  }

  const writtenFiles: string[] = [];

  async function write(relativePath: string, content: string): Promise<void> {
    const absPath = path.join(targetPath, relativePath);
    await writeFile(absPath, content);
    writtenFiles.push(relativePath);
  }

  if (input.language === 'java') {
    const groupId = input.groupId ?? 'com.example';
    const artifactId = input.artifactId ?? toArtifactId(input.name);
    const basePackage = input.basePackage ?? `${groupId}.${toPackageSegment(artifactId)}`;
    const basePath = basePackage.replaceAll('.', '/');

    for (const dir of getJavaDirectoriesToCreate(platforms, basePackage)) {
      await fs.mkdir(path.join(targetPath, dir), { recursive: true });
    }

    await write('pom.xml', renderJavaPom({ name: input.name, groupId, artifactId, platforms }));
    await write('src/test/resources/config/local-overrides.yml', renderJavaConfigYml({ platforms, webBaseUrl: input.webBaseUrl }));
    await write('.gitignore', renderJavaGitignore());
    await write('README.md', renderJavaReadme(input.name, platforms));
    await write('reports/.gitkeep', '');

    await write(`src/test/java/${basePath}/suites/DefaultSuiteTest.java`, renderJavaSuite('all', basePackage));
    for (const platform of platforms) {
      await write(
        `src/test/java/${basePath}/suites/${getJavaSuiteClassName(platform as JavaSuitePlatform)}.java`,
        renderJavaSuite(platform as JavaSuitePlatform, basePackage),
      );
    }

    if (input.includeSamples) {
      const samples = getJavaSamplesForPlatforms(platforms, basePackage);
      for (const sample of samples) {
        await write(sample.relativePath, sample.content);
      }
    }

    const nextSteps = buildJavaNextSteps(targetPath, platforms);

    return {
      path: targetPath,
      files: writtenFiles,
      nextSteps,
    };
  }

  // Create directory structure
  for (const dir of getDirectoriesToCreate(platforms)) {
    await fs.mkdir(path.join(targetPath, dir), { recursive: true });
  }

  // Core config files
  await write('package.json', renderPackageJson({ name: input.name, platforms }));
  await write('tsconfig.json', renderTsConfigJson());
  await write('cucumber.js', renderCucumberJs(platforms));
  await write('.env.example', renderEnvExample(platforms, input.webBaseUrl));
  await write('.gitignore', renderGitignore());
  await write('README.md', renderReadme(input.name, platforms));

  // Add a .gitkeep to reports/ so the directory is tracked
  await write('reports/.gitkeep', '');

  // Bump Cucumber's default 5-second step timeout to 30s — anything involving
  // a real browser, app launch, or network call routinely exceeds 5s. Loaded
  // by cucumber.js via the `support/**/*.ts` glob.
  await write(
    'support/timeout.ts',
    `import { setDefaultTimeout } from '@cucumber/cucumber';

// Cucumber's default step timeout is 5_000 ms — too short for any step that
// drives a real browser, mobile app, desktop app, or HTTP request. Bump to 30s
// here; individual steps can still override via { timeout: N } when needed.
setDefaultTimeout(30_000);
`,
  );

  // Sample files
  if (input.includeSamples) {
    const samples = getSamplesForPlatforms(platforms);
    for (const sample of samples) {
      await write(sample.relativePath, sample.content);
    }
  }

  const nextSteps = buildNextSteps(targetPath, platforms);

  return {
    path: targetPath,
    files: writtenFiles,
    nextSteps,
  };
}
