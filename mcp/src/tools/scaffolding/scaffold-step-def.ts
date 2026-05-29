/**
 * scaffold_step_def: Create or append to a step definition file.
 *
 * If the file doesn't exist, creates it with the proper imports and all steps.
 * If it exists, appends steps that don't already exist (idempotent on pattern).
 * Refuses to create a new file named after an existing one unless overwrite=true.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';
import {
  renderStepDefTemplate,
  appendStepsToExistingContent,
  type StepInput,
} from '../../templates/artifact/step-def.js';

export const scaffoldStepDefInputSchema = z.object({
  platform: z
    .string()
    .describe("Platform name (used as a comment — does not affect the file path)."),
  name: z
    .string()
    .min(1)
    .describe("Base name for the file (without .steps.ts). E.g. 'web' → 'web.steps.ts'."),
  steps: z
    .array(
      z.object({
        type: z.enum(['Given', 'When', 'Then']).describe("Step keyword."),
        pattern: z.string().describe("Cucumber expression pattern, e.g. 'I navigate to {string}'."),
        body: z.string().optional().describe("Optional implementation body (TypeScript code)."),
        paramNames: z
          .array(z.string())
          .optional()
          .describe(
            'Identifier names for the function parameters — one per {string}/{int}/{float}/{word}/{bigdecimal} placeholder, in order. ' +
              'The body should reference these names. ' +
              'STRONGLY RECOMMENDED whenever body is provided, otherwise parameters default to value/value2/count and any body referencing other names will fail to compile. ' +
              'Example: pattern "I log in as {string} with password {string}", paramNames ["email","password"], body uses email/password.',
          ),
      }),
    )
    .min(1)
    .describe("Steps to add. Patterns already in the file are skipped."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Fully overwrite the file if it exists. Default: false (appends new steps)."),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ScaffoldStepDefInput = z.infer<typeof scaffoldStepDefInputSchema>;

export interface ScaffoldStepDefResult {
  readonly path: string;
  readonly content: string;
  readonly created: boolean;
  readonly stepsAdded: number;
}

export async function scaffoldStepDef(
  paths: ProjectPaths,
  input: ScaffoldStepDefInput,
): Promise<ScaffoldStepDefResult> {
  const fileName = input.name.endsWith('.steps.ts')
    ? input.name
    : `${input.name}.steps.ts`;
  const filePath = path.join(paths.stepDefinitions, fileName);

  const stepInputs: StepInput[] = input.steps.map((s) => ({
    type: s.type,
    pattern: s.pattern,
    body: s.body,
    paramNames: s.paramNames,
  }));

  let content: string;
  let created = false;
  let stepsAdded = stepInputs.length;

  try {
    await fs.access(filePath);
    // File exists
    if (input.overwrite) {
      content = renderStepDefTemplate(input.platform, stepInputs);
      created = false;
    } else {
      const existing = await fs.readFile(filePath, 'utf8');
      const originalCount = (existing.match(/^(Given|When|Then)\(/gm) ?? []).length;
      content = appendStepsToExistingContent(existing, stepInputs);
      const newCount = (content.match(/^(Given|When|Then)\(/gm) ?? []).length;
      stepsAdded = newCount - originalCount;
      created = false;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // File doesn't exist — create it
    content = renderStepDefTemplate(input.platform, stepInputs);
    created = true;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');

  return {
    path: filePath,
    content,
    created,
    stepsAdded,
  };
}
