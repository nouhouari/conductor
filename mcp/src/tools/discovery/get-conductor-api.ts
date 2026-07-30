/**
 * get_conductor_api: Return API reference markdown for the Conductor framework.
 *
 * Returns static doc strings from api-reference.ts.
 * Accepts an optional `surface` argument to filter to a specific driver/class.
 */

import { z } from 'zod';
import { getApiReference, ALL_SURFACES, type ApiSurface } from '../../api-reference.js';

export const getConductorApiInputSchema = z.object({
  surface: z
    .enum(['world', 'web', 'api', 'maestro', 'flutter', 'fx', 'db', 'page'])
    .optional()
    .describe(
      "Specific API surface to document. Omit to get all surfaces. " +
      "TypeScript projects get the TypeScript API; Java projects get the Java API. " +
      "Options: world (ConductorWorld), web (WebDriver), api (ApiDriver), " +
      "maestro (MaestroDriver), flutter (FlutterDesktopDriver), fx (JavaFxDriver), " +
      "db (DatabaseDriver), page (BasePage).",
    ),
  projectPath: z
    .string()
    .optional()
    .describe('Optional project root override used to detect whether to return TypeScript or Java API docs.'),
});

export type GetConductorApiInput = z.infer<typeof getConductorApiInputSchema>;

export interface ConductorApiResult {
  readonly surface: string;
  readonly language: 'typescript' | 'java';
  readonly markdown: string;
  readonly availableSurfaces: readonly string[];
}

export function getConductorApi(
  input: GetConductorApiInput,
  language: 'typescript' | 'java' = 'typescript',
): ConductorApiResult {
  const surface = input.surface as ApiSurface | undefined;
  const markdown = getApiReference(surface, language);

  return {
    surface: surface ?? 'all',
    language,
    markdown,
    availableSurfaces: ALL_SURFACES,
  };
}
