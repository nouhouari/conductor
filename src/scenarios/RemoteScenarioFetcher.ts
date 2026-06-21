import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RemoteScenariosConfig } from '../../config/types';

/**
 * Sources cucumber scenarios from the requ scenario API and reconstructs them
 * into `.feature` files on disk so `cucumber-js` (which only reads filesystem
 * globs) can run them — without touching the local `features/` folder.
 *
 * See the requ OpenAPI spec: GET /api/scenarios returns scenario summaries; with
 * `content=true` each carries the raw gherkin of one Scenario block plus the
 * feature's Background.
 */

/** One scenario summary as returned by GET /api/scenarios (with content=true). */
export interface RemoteScenarioSummary {
  /** testKey, i.e. `${feature}::${name}`. */
  id: string;
  feature: string;
  name: string;
  tags: string[];
  storyIds?: string[];
  requirementIds?: string[];
  valid?: boolean;
  hasContent?: boolean;
  hasBackground?: boolean;
  status?: 'pass' | 'fail' | 'pending';
  /** Raw gherkin of this scenario block (its own tag lines + steps + Examples). */
  content?: string;
  /** Raw gherkin of the feature's Background block ("" when none). */
  background?: string;
}

interface ScenarioListResponse {
  total: number;
  scenarios: RemoteScenarioSummary[];
}

/**
 * Fetch scenarios from the requ scenario API, applying server-side filters.
 * Always requests `content=true` so the gherkin body and background come inline.
 */
export async function fetchScenarios(config: RemoteScenariosConfig): Promise<RemoteScenarioSummary[]> {
  const base = config.baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('content', 'true');
  if (config.project) params.set('project', config.project);

  const f = config.filters ?? {};
  if (f.story) params.set('story', f.story);
  if (f.requirement) params.set('requirement', f.requirement);
  if (f.phase) params.set('phase', f.phase);
  if (f.mode) params.set('mode', f.mode);
  if (f.tags) params.set('tags', f.tags);
  if (f.feature) params.set('feature', f.feature);
  if (f.q) params.set('q', f.q);
  if (typeof f.valid === 'boolean') params.set('valid', String(f.valid));

  const url = `${base}/scenarios?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Failed to reach requ scenario API at ${url}: ${(err as Error).message}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string; available?: string[] };
      if (body.error) detail = body.error;
      if (body.available) detail += ` (available projects: ${body.available.join(', ')})`;
    } catch {
      // non-JSON error body; ignore
    }
    throw new Error(`requ scenario API returned ${res.status} for ${url}${detail ? `: ${detail}` : ''}`);
  }

  const data = (await res.json()) as ScenarioListResponse;
  return data.scenarios ?? [];
}

/** Tag tokens on the leading tag lines of a scenario's content block. */
function leadingContentTags(content: string): Set<string> {
  const tags = new Set<string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('@')) {
      for (const t of line.split(/\s+/)) if (t.startsWith('@')) tags.add(t);
      continue;
    }
    break; // first non-tag, non-blank line ends the leading tag block
  }
  return tags;
}

/** Slugify a feature name into a safe `.feature` filename. */
function featureFileName(feature: string): string {
  const slug = feature
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'feature'}.feature`;
}

export interface ReconstructResult {
  /** Number of feature files written. */
  features: number;
  /** Number of scenarios written across all files. */
  scenarios: number;
  /** Absolute path of the output directory. */
  dir: string;
}

/**
 * Reconstruct `.feature` files from API scenario summaries, grouped by feature.
 * Writes one file per feature into `outputDir` (which is cleaned first).
 *
 * Feature-level tags (e.g. `@web`) are recovered as the tags common to every
 * scenario in a feature that do NOT appear on that scenario's own content tag
 * lines, then emitted above `Feature:` so local `--tags`/profiles still match.
 */
export async function reconstructFeatureFiles(
  scenarios: RemoteScenarioSummary[],
  outputDir: string,
): Promise<ReconstructResult> {
  const dir = path.resolve(outputDir);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });

  // Group by feature name, preserving first-seen order.
  const groups = new Map<string, RemoteScenarioSummary[]>();
  for (const sc of scenarios) {
    const list = groups.get(sc.feature) ?? [];
    list.push(sc);
    groups.set(sc.feature, list);
  }

  const usedNames = new Set<string>();
  let featuresWritten = 0;
  let scenariosWritten = 0;

  for (const [feature, group] of groups) {
    // Only content-bearing scenarios contribute to the file and to tag recovery.
    // A feature with a Background but no scenarios is invalid Gherkin, so skip it.
    const withContent = group.filter((sc) => (sc.content ?? '').trim() !== '');
    if (withContent.length === 0) continue;

    // Feature-level tags = present on every scenario, absent from each one's own tag lines.
    let featureTags: Set<string> | null = null;
    for (const sc of withContent) {
      const own = leadingContentTags(sc.content ?? '');
      const inherited = new Set((sc.tags ?? []).filter((t) => !own.has(t)));
      if (featureTags === null) {
        featureTags = inherited;
      } else {
        for (const t of [...featureTags]) if (!inherited.has(t)) featureTags.delete(t);
      }
    }
    // Sorted for deterministic, diff-stable output (tag order is insignificant to cucumber).
    const tags = featureTags ? [...featureTags].sort() : [];

    const background = withContent.find((sc) => (sc.background ?? '').trim() !== '')?.background?.trim();

    const lines: string[] = [];
    if (tags.length) lines.push(tags.join(' '));
    lines.push(`Feature: ${feature}`);
    lines.push('');
    if (background) {
      lines.push(background);
      lines.push('');
    }
    for (const sc of withContent) {
      lines.push((sc.content ?? '').replace(/\s+$/, ''));
      lines.push('');
      scenariosWritten++;
    }

    let name = featureFileName(feature);
    if (usedNames.has(name)) {
      const stem = name.replace(/\.feature$/, '');
      let i = 2;
      while (usedNames.has(`${stem}-${i}.feature`)) i++;
      name = `${stem}-${i}.feature`;
    }
    usedNames.add(name);

    const body = `${lines.join('\n').replace(/\n+$/, '')}\n`;
    await fs.writeFile(path.join(dir, name), body, 'utf8');
    featuresWritten++;
  }

  return { features: featuresWritten, scenarios: scenariosWritten, dir };
}
