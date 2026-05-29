/**
 * scaffold_maestro_flow: Create a Maestro YAML flow file.
 *
 * Writes flows/mobile/<name>.yaml. Steps are validated against a known-command
 * allowlist. Refuses to overwrite unless overwrite=true.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';
import {
  renderMaestroFlowTemplate,
  KNOWN_MAESTRO_COMMANDS,
} from '../../templates/artifact/maestro-flow.js';

export const scaffoldMaestroFlowInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("Flow name (used as the filename). E.g. 'create-todo' → 'create-todo.yaml'."),
  appId: z
    .string()
    .min(1)
    .describe("Android/iOS app bundle ID, e.g. 'com.example.myapp'."),
  steps: z
    .array(z.record(z.unknown()))
    .min(1)
    .describe(
      "Maestro step objects. Each object should have one key (the command name) and its value. " +
      `Known commands: ${[...KNOWN_MAESTRO_COMMANDS].join(', ')}.`,
    ),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Overwrite if the file already exists. Default: false."),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ScaffoldMaestroFlowInput = z.infer<typeof scaffoldMaestroFlowInputSchema>;

export interface ScaffoldMaestroFlowResult {
  readonly path: string;
  readonly content: string;
  readonly created: boolean;
  readonly unknownCommands: readonly string[];
}

export async function scaffoldMaestroFlow(
  paths: ProjectPaths,
  input: ScaffoldMaestroFlowInput,
): Promise<ScaffoldMaestroFlowResult> {
  const fileName = input.name.endsWith('.yaml') ? input.name : `${input.name}.yaml`;
  const filePath = path.join(paths.flows, fileName);
  const content = renderMaestroFlowTemplate(input.appId, input.steps);

  // Detect unknown commands (warning, not an error)
  const unknownCommands = input.steps.flatMap((step) =>
    Object.keys(step).filter((cmd) => !KNOWN_MAESTRO_COMMANDS.has(cmd)),
  );

  // Check existence
  try {
    await fs.access(filePath);
    if (!input.overwrite) {
      throw new Error(
        `File already exists at "${filePath}". Pass overwrite: true to replace it.`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');

  return {
    path: filePath,
    content,
    created: true,
    unknownCommands,
  };
}
