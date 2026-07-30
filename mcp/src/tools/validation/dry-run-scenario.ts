/**
 * dry_run_scenario: Validate step definitions without executing them.
 *
 * TypeScript projects: spawns `npx cucumber-js --dry-run --format json`.
 * Java projects: compiles the test sources with Maven, resolves the test
 * classpath, then runs Cucumber-JVM's CLI (`io.cucumber.core.cli.Main`) with
 * `--dry-run` and a json plugin. The CLI is used instead of `mvn test` because
 * the suite classes pin `@ConfigurationParameter` values (features, tags,
 * plugins) that take precedence over `-D` system properties, which would make
 * the featurePath/tag/scenarioName inputs silently ineffective.
 *
 * Both paths emit the same cucumber JSON, so a single parser serves both.
 *
 * For each undefined step, attempts to find a similar existing step
 * using simple substring matching and reports a suggestion.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';

export const dryRunScenarioInputSchema = z.object({
  featurePath: z
    .string()
    .optional()
    .describe("Relative path to a specific feature file (relative to project root). Omit to validate all features."),
  scenarioName: z
    .string()
    .optional()
    .describe("Run only scenarios matching this name substring (passed as --name)."),
  tag: z
    .string()
    .optional()
    .describe("Run only scenarios with this tag (e.g. '@web')."),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (a TypeScript project containing ' +
      'cucumber.js, or a Java Maven module containing src/test/java glue). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type DryRunScenarioInput = z.infer<typeof dryRunScenarioInputSchema>;

export interface UndefinedStep {
  readonly pattern: string;
  readonly suggestion: string | null;
}

export interface DryRunResult {
  readonly success: boolean;
  readonly scenarios: number;
  readonly steps: {
    readonly total: number;
    readonly passed: number;
    readonly undefined: readonly UndefinedStep[];
    readonly pending: number;
    readonly failed: number;
  };
  readonly rawOutput: string;
  readonly errorMessage: string | null;
}

// Shape of cucumber-js JSON formatter output we care about
interface CucumberJsonStep {
  keyword: string;
  name: string;
  result?: {
    status: string;
    error_message?: string;
  };
}

interface CucumberJsonScenario {
  type: string;
  steps: CucumberJsonStep[];
}

interface CucumberJsonFeature {
  elements: CucumberJsonScenario[];
}

function parseJsonOutput(jsonStr: string): {
  scenarioCount: number;
  total: number;
  passed: number;
  undefined: string[];
  pending: number;
  failed: number;
} {
  let features: CucumberJsonFeature[];
  try {
    features = JSON.parse(jsonStr) as CucumberJsonFeature[];
  } catch {
    return { scenarioCount: 0, total: 0, passed: 0, undefined: [], pending: 0, failed: 0 };
  }

  let scenarioCount = 0;
  let total = 0;
  let passed = 0;
  const undefinedSteps: string[] = [];
  let pending = 0;
  let failed = 0;

  for (const feature of features) {
    for (const scenario of feature.elements) {
      if (scenario.type === 'background') continue;
      scenarioCount++;
      for (const step of scenario.steps) {
        total++;
        const status = step.result?.status ?? 'undefined';
        switch (status) {
          case 'passed':
            passed++;
            break;
          case 'undefined':
            undefinedSteps.push(step.name);
            break;
          case 'pending':
            pending++;
            break;
          case 'failed':
            failed++;
            break;
        }
      }
    }
  }

  return { scenarioCount, total, passed, undefined: undefinedSteps, pending, failed };
}

function findSuggestion(pattern: string, knownPatterns: string[]): string | null {
  if (knownPatterns.length === 0) return null;

  const normalised = pattern.toLowerCase().trim();
  const words = normalised.split(/\s+/);

  let best: string | null = null;
  let bestScore = 0;

  for (const known of knownPatterns) {
    const knownNorm = known.toLowerCase();
    // Count how many words from the undefined step appear in the known pattern
    const matchCount = words.filter((w) => knownNorm.includes(w)).length;
    const score = matchCount / Math.max(words.length, 1);
    if (score > bestScore) {
      bestScore = score;
      best = known;
    }
  }

  // Only suggest if similarity is above 30%
  return bestScore >= 0.3 ? best : null;
}

async function extractKnownPatterns(
  stepDefinitionsDir: string,
  language: ProjectPaths['language'],
): Promise<string[]> {
  const { readdir, readFile } = await import('node:fs/promises');
  const patterns: string[] = [];
  const ext = language === 'java' ? '.java' : '.ts';
  // TS: Given('...'), Java: @Given("...")
  const stepRegex =
    language === 'java'
      ? /@(?:Given|When|Then)\s*\(\s*"([\s\S]*?)"\s*\)/g
      : /(?:Given|When|Then)\s*\(\s*['"`]([\s\S]*?)['"`]/g;

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
          try {
            const content = await readFile(fullPath, 'utf8');
            const regex = new RegExp(stepRegex.source, 'g');
            let match: RegExpExecArray | null;
            while ((match = regex.exec(content)) !== null) {
              if (match[1]) patterns.push(match[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"'));
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  await walk(stepDefinitionsDir);
  return patterns;
}

/** Spawn a command, capturing output, with a hard timeout. */
function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, {
      cwd,
      env: process.env,
      // Prevent the dry-run from inheriting the parent's stdin
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        stdout,
        stderr: stderr + '\n[conductor-mcp] Dry-run timed out',
        exitCode: -1,
      });
    }, timeoutMs);

    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: `${stderr}\n[conductor-mcp] ${error.message}`, exitCode: -1 });
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}

async function runDryRun(
  projectRoot: string,
  args: string[],
  timeoutMs = 60000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runCommand(
    'npx',
    ['cucumber-js', '--dry-run', '--format', 'json', ...args],
    projectRoot,
    timeoutMs,
  );
}

/** Maven wrapper if the module (or its parent) ships one, otherwise plain mvn. */
async function resolveMavenCommand(moduleDir: string): Promise<string> {
  for (const dir of [moduleDir, path.dirname(moduleDir)]) {
    const wrapper = path.join(dir, 'mvnw');
    try {
      await fs.access(wrapper);
      return wrapper;
    } catch {
      // Keep looking
    }
  }
  return 'mvn';
}

/**
 * Compile test sources, resolve the test classpath, and run Cucumber-JVM's CLI
 * in dry-run mode. Returns the parsed-ready JSON plus the raw tool output.
 */
async function runJavaDryRun(
  paths: ProjectPaths,
  input: DryRunScenarioInput,
): Promise<{ json: string; output: string; exitCode: number }> {
  const moduleDir = paths.javaModule ?? paths.root;
  const mvn = await resolveMavenCommand(moduleDir);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conductor-dry-run-'));
  const classpathFile = path.join(tmpDir, 'classpath.txt');
  const reportFile = path.join(tmpDir, 'dry-run.json');
  let output = '';

  try {
    const compile = await runCommand(mvn, ['-B', '-q', 'test-compile'], moduleDir, 300000);
    output += `$ ${mvn} -B -q test-compile\n${compile.stdout}\n${compile.stderr}\n`;
    if (compile.exitCode !== 0) {
      return { json: '', output, exitCode: compile.exitCode };
    }

    const cp = await runCommand(
      mvn,
      [
        '-B',
        '-q',
        'dependency:build-classpath',
        `-Dmdep.outputFile=${classpathFile}`,
        '-Dmdep.includeScope=test',
      ],
      moduleDir,
      300000,
    );
    output += `\n$ ${mvn} -B -q dependency:build-classpath\n${cp.stdout}\n${cp.stderr}\n`;
    if (cp.exitCode !== 0) {
      return { json: '', output, exitCode: cp.exitCode };
    }

    const deps = (await fs.readFile(classpathFile, 'utf8')).trim();
    const classpath = [
      path.join(moduleDir, 'target', 'test-classes'),
      path.join(moduleDir, 'target', 'classes'),
      deps,
    ]
      .filter((entry) => entry.length > 0)
      .join(path.delimiter);

    const glue = paths.javaGluePackages ?? [];
    const cliArgs = ['-cp', classpath, 'io.cucumber.core.cli.Main', '--dry-run', '--plugin', `json:${reportFile}`];
    for (const pkg of glue) {
      cliArgs.push('--glue', pkg);
    }
    if (input.scenarioName) cliArgs.push('--name', input.scenarioName);
    if (input.tag) cliArgs.push('--tags', input.tag);
    cliArgs.push(
      input.featurePath ? path.resolve(paths.root, input.featurePath) : paths.features,
    );

    const run = await runCommand('java', cliArgs, moduleDir, 120000);
    output += `\n$ java io.cucumber.core.cli.Main --dry-run ...\n${run.stdout}\n${run.stderr}\n`;

    let json = '';
    try {
      json = (await fs.readFile(reportFile, 'utf8')).trim();
    } catch {
      // Left empty — the caller reports the missing-JSON error
    }
    return { json, output, exitCode: run.exitCode };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function dryRunScenario(
  paths: ProjectPaths,
  input: DryRunScenarioInput,
): Promise<DryRunResult> {
  const { jsonOutput, combinedOutput, exitCode } =
    paths.language === 'java'
      ? await collectJavaOutput(paths, input)
      : await collectTypeScriptOutput(paths, input);

  if (!jsonOutput || (!jsonOutput.startsWith('[') && !jsonOutput.startsWith('{'))) {
    // No valid JSON output — likely a config or compilation error
    return {
      success: false,
      scenarios: 0,
      steps: { total: 0, passed: 0, undefined: [], pending: 0, failed: 0 },
      rawOutput: combinedOutput,
      errorMessage:
        `Cucumber dry-run did not produce JSON output (exit code ${exitCode}). ` +
        `Output tail: ${combinedOutput.slice(-500)}`,
    };
  }

  const parsed = parseJsonOutput(jsonOutput);
  const knownPatterns = await extractKnownPatterns(paths.stepDefinitions, paths.language);

  const undefinedWithSuggestions: UndefinedStep[] = parsed.undefined.map((pattern) => ({
    pattern,
    suggestion: findSuggestion(pattern, knownPatterns),
  }));

  const success = parsed.undefined.length === 0 && parsed.failed === 0 && exitCode === 0;

  return {
    success,
    scenarios: parsed.scenarioCount,
    steps: {
      total: parsed.total,
      passed: parsed.passed,
      undefined: undefinedWithSuggestions,
      pending: parsed.pending,
      failed: parsed.failed,
    },
    rawOutput: combinedOutput,
    errorMessage: success ? null : `Dry-run completed with issues. See steps.undefined for undefined steps.`,
  };
}

/** TypeScript path: cucumber-js writes JSON to stdout, progress to stderr. */
async function collectTypeScriptOutput(
  paths: ProjectPaths,
  input: DryRunScenarioInput,
): Promise<{ jsonOutput: string; combinedOutput: string; exitCode: number }> {
  const args: string[] = [];

  if (input.featurePath) {
    args.push(path.resolve(paths.root, input.featurePath));
  }
  if (input.scenarioName) {
    args.push('--name', input.scenarioName);
  }
  if (input.tag) {
    args.push('--tags', input.tag);
  }

  const { stdout, stderr, exitCode } = await runDryRun(paths.root, args);

  return {
    jsonOutput: stdout.trim(),
    combinedOutput: `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
    exitCode,
  };
}

/** Java path: Cucumber-JVM writes JSON to a file via the json plugin. */
async function collectJavaOutput(
  paths: ProjectPaths,
  input: DryRunScenarioInput,
): Promise<{ jsonOutput: string; combinedOutput: string; exitCode: number }> {
  const { json, output, exitCode } = await runJavaDryRun(paths, input);
  return { jsonOutput: json, combinedOutput: output, exitCode };
}
