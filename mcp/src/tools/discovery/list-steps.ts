/**
 * list_steps: Walk step-definitions/**\/*.ts and extract Cucumber step definitions.
 *
 * Extracts:
 * - pattern (the string/regex passed to Given/When/Then)
 * - type (Given/When/Then)
 * - file + line number
 * - paramTypes (detected {string}, {int}, etc.)
 * - usedInFeatures (features referencing this step text)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';

export const listStepsInputSchema = z.object({
  filter: z.enum(['given', 'when', 'then']).optional().describe(
    "Restrict to a specific step type. Omit for all steps.",
  ),
  q: z.string().optional().describe(
    "Filter step patterns by substring match (case-insensitive).",
  ),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ListStepsInput = z.infer<typeof listStepsInputSchema>;

export interface StepInfo {
  readonly pattern: string;
  readonly type: 'Given' | 'When' | 'Then';
  readonly file: string;
  readonly line: number;
  readonly paramTypes: readonly string[];
  readonly usedInFeatures: readonly string[];
}

/** Regex to match Given/When/Then declarations with string or backtick delimiters. */
const STEP_REGEX = /^\s*(Given|When|Then)\s*\(\s*(['"`])([\s\S]*?)\2/;

/** Regex to extract Cucumber parameter types like {string}, {int}, etc. */
const PARAM_TYPE_REGEX = /\{(string|int|float|word|bigdecimal|[a-z]+)\}/g;

async function walkDirectory(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...await walkDirectory(fullPath, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist — return empty
  }
  return results;
}

async function extractStepsFromFile(
  filePath: string,
  projectRoot: string,
): Promise<StepInfo[]> {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  const steps: StepInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // lines[i] is always defined because we split on '\n' and iterate within bounds
    const match = STEP_REGEX.exec(line ?? '');
    if (!match) continue;

    const type = match[1] as 'Given' | 'When' | 'Then';
    const pattern = match[3] ?? '';

    const paramTypes: string[] = [];
    let paramMatch: RegExpExecArray | null;
    const paramRegex = new RegExp(PARAM_TYPE_REGEX.source, 'g');
    while ((paramMatch = paramRegex.exec(pattern)) !== null) {
      if (paramMatch[1]) paramTypes.push(paramMatch[1]);
    }

    steps.push({
      pattern,
      type,
      file: path.relative(projectRoot, filePath),
      line: i + 1,
      paramTypes,
      usedInFeatures: [], // populated in a second pass
    });
  }

  return steps;
}

async function findFeaturesUsingStep(
  pattern: string,
  featuresDir: string,
  projectRoot: string,
): Promise<string[]> {
  const featureFiles = await walkDirectory(featuresDir, '.feature');
  const results: string[] = [];

  // Convert Cucumber expression to a rough substring match
  // Replace {string}, {int} etc. with a wildcard-friendly match
  const simplifiedPattern = pattern
    .replace(/\{[a-z]+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!simplifiedPattern) return results;

  for (const file of featureFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lower = content.toLowerCase();
      if (lower.includes(simplifiedPattern.slice(0, 20))) {
        results.push(path.relative(projectRoot, file));
      }
    } catch {
      // Skip unreadable files
    }
  }
  return results;
}

export async function listSteps(
  paths: ProjectPaths,
  input: ListStepsInput,
): Promise<StepInfo[]> {
  const files = await walkDirectory(paths.stepDefinitions, '.ts');
  const allSteps: StepInfo[] = [];

  for (const file of files) {
    const steps = await extractStepsFromFile(file, paths.root);
    allSteps.push(...steps);
  }

  // Apply filters
  let filtered = allSteps;

  if (input.filter) {
    const typeFilter = input.filter.charAt(0).toUpperCase() + input.filter.slice(1) as 'Given' | 'When' | 'Then';
    filtered = filtered.filter((s) => s.type === typeFilter);
  }

  if (input.q) {
    const query = input.q.toLowerCase();
    filtered = filtered.filter((s) => s.pattern.toLowerCase().includes(query));
  }

  // Second pass: find features using each step
  const stepsWithFeatures = await Promise.all(
    filtered.map(async (step) => {
      const usedInFeatures = await findFeaturesUsingStep(
        step.pattern,
        paths.features,
        paths.root,
      );
      return { ...step, usedInFeatures };
    }),
  );

  return stepsWithFeatures;
}
