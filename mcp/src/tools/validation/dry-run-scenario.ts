/**
 * dry_run_scenario: Validate step definitions by running cucumber-js --dry-run.
 *
 * Spawns npx cucumber-js --dry-run --format json in the project root,
 * parses the JSON output, and returns a structured result.
 *
 * For each undefined step, attempts to find a similar existing step
 * using simple substring matching and reports a suggestion.
 */

import { spawn } from 'node:child_process';
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
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
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

async function extractKnownPatterns(stepDefinitionsDir: string): Promise<string[]> {
  const { readdir, readFile } = await import('node:fs/promises');
  const patterns: string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          try {
            const content = await readFile(fullPath, 'utf8');
            const regex = /(?:Given|When|Then)\s*\(\s*['"`]([\s\S]*?)['"`]/g;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(content)) !== null) {
              if (match[1]) patterns.push(match[1]);
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

async function runDryRun(
  projectRoot: string,
  args: string[],
  timeoutMs = 60000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('npx', ['cucumber-js', '--dry-run', '--format', 'json', ...args], {
      cwd: projectRoot,
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

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}

export async function dryRunScenario(
  paths: ProjectPaths,
  input: DryRunScenarioInput,
): Promise<DryRunResult> {
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

  // cucumber-js with --format json writes JSON to stdout; progress info to stderr
  const jsonOutput = stdout.trim();
  const combinedOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;

  if (!jsonOutput || (!jsonOutput.startsWith('[') && !jsonOutput.startsWith('{'))) {
    // No valid JSON output — likely a config error
    return {
      success: false,
      scenarios: 0,
      steps: { total: 0, passed: 0, undefined: [], pending: 0, failed: 0 },
      rawOutput: combinedOutput,
      errorMessage:
        `Cucumber dry-run did not produce JSON output (exit code ${exitCode}). ` +
        `stderr: ${stderr.slice(0, 500)}`,
    };
  }

  const parsed = parseJsonOutput(jsonOutput);
  const knownPatterns = await extractKnownPatterns(paths.stepDefinitions);

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
