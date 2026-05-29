/**
 * get_config: Return the resolved EnvironmentConfig for the current project.
 *
 * Reports which env vars are currently set that would override defaults.
 * The MCP server does NOT import conductor-e2e — we reconstruct from env vars
 * and the defaults documented in the framework.
 */

import { z } from 'zod';
import type { ProjectContextResult } from '../../project.js';

export const getConfigInputSchema = z.object({
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type GetConfigInput = z.infer<typeof getConfigInputSchema>;

export interface ConfigResult {
  readonly projectName: string;
  readonly projectRoot: string;
  readonly config: {
    readonly web: {
      readonly baseUrl: string;
      readonly headless: boolean;
      readonly browserName: string;
    };
    readonly api: {
      readonly baseUrl: string;
    };
    readonly mobile: {
      readonly flowsDir: string;
      readonly deviceId: string | null;
    };
  };
  readonly envVarsSet: Readonly<Record<string, string | undefined>>;
  readonly envVarsAvailable: readonly {
    readonly name: string;
    readonly description: string;
    readonly currentValue: string | null;
  }[];
}

const ENV_VAR_DESCRIPTIONS: Record<string, string> = {
  TEST_ENV: 'Selects the environment config overlay (default, dev, staging)',
  WEB_BASE_URL: 'Overrides web.baseUrl',
  API_BASE_URL: 'Overrides api.baseUrl',
  HEADLESS: 'true/false — overrides web.headless',
  BROWSER: 'chromium/firefox/webkit — overrides web.browserName',
  MAESTRO_DEVICE: 'Target Android device/emulator ID for Maestro',
  DEBUG_MAESTRO: 'Set to 0 to silence Maestro CLI output',
  DATABASE_URL: 'Database connection string (used by custom DatabaseDriver adapters)',
};

export function getConfig(context: ProjectContextResult): ConfigResult {
  if (!context.isInitialized) {
    throw new Error('Project not initialized. Run init_project first.');
  }

  const { config, paths } = context;

  const envVarsAvailable = Object.entries(ENV_VAR_DESCRIPTIONS).map(([name, description]) => ({
    name,
    description,
    currentValue: process.env[name] ?? null,
  }));

  return {
    projectName: config.name,
    projectRoot: paths.root,
    config: {
      web: {
        baseUrl: config.webBaseUrl,
        headless: process.env['HEADLESS'] !== 'false',
        browserName: process.env['BROWSER'] ?? 'chromium',
      },
      api: {
        baseUrl: config.apiBaseUrl,
      },
      mobile: {
        flowsDir: config.flowsDir,
        deviceId: process.env['MAESTRO_DEVICE'] ?? null,
      },
    },
    envVarsSet: config.envVarsSet,
    envVarsAvailable,
  };
}
