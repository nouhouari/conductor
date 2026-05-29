/**
 * list_features: Walk features/**\/*.feature and parse Gherkin structure.
 *
 * Uses a simple line-based parser. Returns scenarios with their tags and steps.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';

export const listFeaturesInputSchema = z.object({
  tag: z.string().optional().describe(
    "Filter scenarios by tag (e.g. '@web', '@mobile'). Include the @ prefix.",
  ),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, the server auto-discovers by walking up from cwd and one level ' +
      'down through common subdirs (tests/, e2e/, e2e-conductor/, qa/, ...). ' +
      'Pass this in monorepos where the heuristics fail.',
  ),
});

export type ListFeaturesInput = z.infer<typeof listFeaturesInputSchema>;

export interface ScenarioInfo {
  readonly name: string;
  readonly tags: readonly string[];
  readonly steps: readonly string[];
}

export interface FeatureInfo {
  readonly file: string;
  readonly featureName: string;
  readonly tags: readonly string[];
  readonly scenarios: readonly ScenarioInfo[];
}

function parseTags(line: string): string[] {
  const tagRegex = /@[\w-]+/g;
  return line.match(tagRegex) ?? [];
}

function parseFeatureFile(content: string, filePath: string, projectRoot: string): FeatureInfo {
  const lines = content.split('\n');

  let featureName = '';
  let featureTags: string[] = [];
  const scenarios: ScenarioInfo[] = [];

  let pendingTags: string[] = [];
  let currentScenario: { name: string; tags: string[]; steps: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('@')) {
      pendingTags.push(...parseTags(line));
      continue;
    }

    if (line.startsWith('Feature:')) {
      featureName = line.slice('Feature:'.length).trim();
      featureTags = [...pendingTags];
      pendingTags = [];
      continue;
    }

    if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      const prefix = line.startsWith('Scenario Outline:') ? 'Scenario Outline:' : 'Scenario:';
      currentScenario = {
        name: line.slice(prefix.length).trim(),
        tags: [...pendingTags],
        steps: [],
      };
      pendingTags = [];
      continue;
    }

    if (line.startsWith('Background:')) {
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      currentScenario = {
        name: '(Background)',
        tags: [...pendingTags],
        steps: [],
      };
      pendingTags = [];
      continue;
    }

    if (currentScenario && /^(Given|When|Then|And|But)\s/.test(line)) {
      currentScenario.steps.push(line);
      continue;
    }

    // Reset pending tags if we hit a non-tag non-step line (like Examples:, |table|, etc.)
    if (line && !line.startsWith('|') && !line.startsWith('"""') && !line.startsWith('#')) {
      // Only reset if not inside a scenario step sequence
    }
  }

  if (currentScenario) {
    scenarios.push(currentScenario);
  }

  return {
    file: path.relative(projectRoot, filePath),
    featureName,
    tags: featureTags,
    scenarios,
  };
}

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
    // Directory doesn't exist
  }
  return results;
}

export async function listFeatures(
  paths: ProjectPaths,
  input: ListFeaturesInput,
): Promise<FeatureInfo[]> {
  const files = await walkDirectory(paths.features, '.feature');
  const results: FeatureInfo[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const info = parseFeatureFile(content, file, paths.root);
      results.push(info);
    } catch {
      // Skip unreadable files
    }
  }

  // Filter by tag if specified
  if (input.tag) {
    const tagFilter = input.tag.toLowerCase();
    return results
      .map((feature) => ({
        ...feature,
        scenarios: feature.scenarios.filter((s) =>
          s.tags.some((t) => t.toLowerCase() === tagFilter) ||
          feature.tags.some((t) => t.toLowerCase() === tagFilter),
        ),
      }))
      .filter((f) => f.scenarios.length > 0);
  }

  return results;
}
