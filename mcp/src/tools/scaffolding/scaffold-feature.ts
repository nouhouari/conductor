/**
 * scaffold_feature: Create a new Cucumber feature file.
 *
 * Writes features/<platform>/<name>.feature with the appropriate tag
 * and the provided scenarios. Refuses to overwrite unless overwrite=true.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';
import { renderFeatureTemplate } from '../../templates/artifact/feature.js';

export const scaffoldFeatureInputSchema = z.object({
  platform: z
    .enum(['web', 'api', 'mobile', 'desktop', 'cross-platform'])
    .describe("Platform determines the feature subdirectory and scenario tag."),
  name: z
    .string()
    .min(1)
    .describe("Feature name (used as file name and Feature: title). Use kebab-case for the file name."),
  scenarios: z
    .array(
      z.object({
        name: z.string().describe("Scenario name (the text after 'Scenario:')."),
        steps: z.array(z.string()).describe("Step lines. Prefix with Given/When/Then/And/But or they default to Given."),
      }),
    )
    .min(1)
    .describe("One or more scenarios to include in the feature."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Overwrite if the file already exists. Default: false."),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ScaffoldFeatureInput = z.infer<typeof scaffoldFeatureInputSchema>;

export interface ScaffoldFeatureResult {
  readonly path: string;
  readonly content: string;
  readonly created: boolean;
}

export async function scaffoldFeature(
  paths: ProjectPaths,
  input: ScaffoldFeatureInput,
): Promise<ScaffoldFeatureResult> {
  // Normalise name: use as-is for Feature: title, convert to kebab-case for filename
  const kebabName = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const fileName = `${kebabName}.feature`;
  const featurePath = path.join(paths.features, input.platform, fileName);
  const content = renderFeatureTemplate(input.platform, input.name, input.scenarios);

  // Check existence
  try {
    await fs.access(featurePath);
    // File exists
    if (!input.overwrite) {
      throw new Error(
        `File already exists at "${featurePath}". Pass overwrite: true to replace it.`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
    // ENOENT means it doesn't exist — proceed
  }

  await fs.mkdir(path.dirname(featurePath), { recursive: true });
  await fs.writeFile(featurePath, content, 'utf8');

  return {
    path: featurePath,
    content,
    created: true,
  };
}
