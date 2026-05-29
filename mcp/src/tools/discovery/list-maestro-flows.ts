/**
 * list_maestro_flows: Walk flows/mobile/**\/*.yaml, parse with js-yaml,
 * and extract env-var placeholders and step command names.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';

export const listMaestroFlowsInputSchema = z.object({
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ListMaestroFlowsInput = z.infer<typeof listMaestroFlowsInputSchema>;

export interface MaestroFlowInfo {
  readonly name: string;
  readonly file: string;
  readonly appId: string;
  readonly envVars: readonly string[];
  readonly steps: readonly string[];
}

/** Regex to extract ${VAR_NAME} style env var placeholders. */
const ENV_VAR_REGEX = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

function extractEnvVars(content: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(ENV_VAR_REGEX.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) vars.add(match[1]);
  }
  return [...vars].sort();
}

function extractStepNames(flowBody: unknown[]): string[] {
  const steps: string[] = [];
  for (const step of flowBody) {
    if (typeof step !== 'object' || step === null) continue;
    const keys = Object.keys(step);
    if (keys.length > 0 && keys[0]) {
      steps.push(keys[0]);
    }
  }
  return steps;
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

async function parseMaestroFlow(
  filePath: string,
  projectRoot: string,
): Promise<MaestroFlowInfo | null> {
  const rawContent = await fs.readFile(filePath, 'utf8');

  // Maestro YAML uses a separator `---` to split appId header from flow body.
  // js-yaml's loadAll handles multi-document YAML.
  const docs: unknown[] = [];
  yaml.loadAll(rawContent, (doc) => docs.push(doc));

  let appId = '';
  let flowBody: unknown[] = [];

  if (docs.length === 1) {
    // Single document — all steps, no explicit appId header
    if (Array.isArray(docs[0])) {
      flowBody = docs[0];
    } else if (typeof docs[0] === 'object' && docs[0] !== null) {
      const doc = docs[0] as Record<string, unknown>;
      appId = typeof doc['appId'] === 'string' ? doc['appId'] : '';
    }
  } else if (docs.length >= 2) {
    // Two-document format: first is header (appId), second is steps array
    const header = docs[0];
    if (typeof header === 'object' && header !== null) {
      appId = String((header as Record<string, unknown>)['appId'] ?? '');
    }
    if (Array.isArray(docs[1])) {
      flowBody = docs[1];
    }
  }

  const envVars = extractEnvVars(rawContent);
  const steps = extractStepNames(flowBody);
  const name = path.basename(filePath, '.yaml');

  return {
    name,
    file: path.relative(projectRoot, filePath),
    appId,
    envVars,
    steps,
  };
}

export async function listMaestroFlows(
  paths: ProjectPaths,
  _input: ListMaestroFlowsInput,
): Promise<MaestroFlowInfo[]> {
  const files = await walkDirectory(paths.flows, '.yaml');
  const results: MaestroFlowInfo[] = [];

  for (const file of files) {
    try {
      const info = await parseMaestroFlow(file, paths.root);
      if (info) results.push(info);
    } catch {
      // Skip files that can't be parsed
    }
  }

  return results;
}
