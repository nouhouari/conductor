/**
 * remove_samples: Delete the sample artifacts that init_project wrote.
 *
 * Use case: a fresh project bootstrapped with `init_project({ includeSamples: true })`
 * ships example.feature / *.steps.ts / pages/ExamplePage.ts / flows/* so that
 * `cucumber-js --dry-run` is green out of the box. Once the AI has scaffolded
 * the real features the user actually wants, those placeholders become noise
 * (they show up as undefined-scenario lines in `npm test`).
 *
 * Safety:
 *   - Only deletes files whose content is byte-equivalent to what init_project
 *     would write today. Anything the user has edited is left in place.
 *   - Pass `force: true` to delete regardless of content (the file paths are
 *     still constrained to known sample locations).
 *   - Optional `platforms` filter restricts the scope.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';
import { getSamplesForPlatforms } from '../../templates/project/samples.js';

const PLATFORM_VALUES = ['web', 'api', 'mobile', 'desktop', 'cross-platform'] as const;

export const removeSamplesInputSchema = z.object({
  platforms: z
    .array(z.enum(PLATFORM_VALUES))
    .optional()
    .describe(
      "Restrict cleanup to these platforms. Defaults to all five. " +
        "E.g. ['web', 'api'] only removes web and api sample files.",
    ),
  force: z
    .boolean()
    .default(false)
    .describe(
      'Delete sample files even when their content has been modified. ' +
        'Default false — modified files are skipped so user edits never get clobbered.',
    ),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type RemoveSamplesInput = z.infer<typeof removeSamplesInputSchema>;

export interface RemovalEntry {
  readonly file: string;
  readonly removed: boolean;
  readonly reason?: 'missing' | 'modified' | 'force';
}

export interface RemoveSamplesResult {
  readonly removed: readonly string[];
  readonly skipped: readonly RemovalEntry[];
  readonly emptyDirsRemoved: readonly string[];
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Remove a directory if it's empty. Returns true if it was removed. */
async function removeIfEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
      return true;
    }
  } catch {
    // Directory doesn't exist or can't be read — ignore.
  }
  return false;
}

export async function removeSamples(
  paths: ProjectPaths,
  input: RemoveSamplesInput,
): Promise<RemoveSamplesResult> {
  const targetPlatforms = input.platforms ?? PLATFORM_VALUES;
  const samples = getSamplesForPlatforms(targetPlatforms);

  const removed: string[] = [];
  const skipped: RemovalEntry[] = [];
  const touchedDirs = new Set<string>();

  for (const sample of samples) {
    const absPath = path.join(paths.root, sample.relativePath);
    const actual = await readIfExists(absPath);

    if (actual === null) {
      skipped.push({ file: sample.relativePath, removed: false, reason: 'missing' });
      continue;
    }

    if (actual !== sample.content && !input.force) {
      skipped.push({ file: sample.relativePath, removed: false, reason: 'modified' });
      continue;
    }

    await fs.unlink(absPath);
    removed.push(sample.relativePath);
    touchedDirs.add(path.dirname(absPath));

    if (input.force && actual !== sample.content) {
      // Annotate why we deleted it despite modifications.
      skipped.push({ file: sample.relativePath, removed: true, reason: 'force' });
    }
  }

  // Best-effort: remove now-empty directories so the tree is tidy.
  const emptyDirsRemoved: string[] = [];
  for (const dir of touchedDirs) {
    if (await removeIfEmpty(dir)) {
      emptyDirsRemoved.push(path.relative(paths.root, dir));
    }
  }

  return { removed, skipped, emptyDirsRemoved };
}
