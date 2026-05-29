import 'dotenv/config';

import { defaultConfig } from './environments/default';
import type { EnvironmentConfig } from './types';

function loadConfig(): EnvironmentConfig {
  const env = process.env.TEST_ENV ?? 'default';
  let base = defaultConfig;

  if (env !== 'default') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const envModule = require(`./environments/${env}`);
      const envConfig = envModule[`${env}Config`] as EnvironmentConfig;
      base = deepMerge(base, envConfig);
    } catch {
      // fall back to default
    }
  }

  // env-var overrides
  if (process.env.WEB_BASE_URL) base.web.baseUrl = process.env.WEB_BASE_URL;
  if (process.env.API_BASE_URL) base.api.baseUrl = process.env.API_BASE_URL;
  if (process.env.HEADLESS) base.web.headless = process.env.HEADLESS !== 'false';
  if (process.env.BROWSER) base.web.browserName = process.env.BROWSER as EnvironmentConfig['web']['browserName'];
  if (process.env.MAESTRO_DEVICE) base.mobile.deviceId = process.env.MAESTRO_DEVICE;

  return base;
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override ?? {}) as (keyof T)[]) {
    const ov = override[key];
    if (ov !== null && typeof ov === 'object' && !Array.isArray(ov)) {
      result[key] = deepMerge(result[key] as object, ov as object) as T[typeof key];
    } else if (ov !== undefined) {
      result[key] = ov as T[typeof key];
    }
  }
  return result;
}

export const config = loadConfig();
export { loadConfig };
export type { EnvironmentConfig };
