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
    .enum(['world', 'web', 'api', 'maestro', 'fx', 'db', 'page'])
    .optional()
    .describe(
      "Specific API surface to document. Omit to get all surfaces. " +
      "Options: world (ConductorWorld), web (WebDriver), api (ApiDriver), " +
      "maestro (MaestroDriver), fx (JavaFxDriver), db (DatabaseDriver), page (BasePage).",
    ),
});

export type GetConductorApiInput = z.infer<typeof getConductorApiInputSchema>;

export interface ConductorApiResult {
  readonly surface: string;
  readonly markdown: string;
  readonly availableSurfaces: readonly string[];
}

export function getConductorApi(input: GetConductorApiInput): ConductorApiResult {
  const surface = input.surface as ApiSurface | undefined;
  const markdown = getApiReference(surface);

  return {
    surface: surface ?? 'all',
    markdown,
    availableSurfaces: ALL_SURFACES,
  };
}
