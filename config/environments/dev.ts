import type { EnvironmentConfig } from '../types';

export const devConfig: Partial<EnvironmentConfig> = {
  name: 'dev',
  web: {
    baseUrl: 'http://localhost:3000',
    headless: false,
    browserName: 'chromium',
    slowMo: 100
  },
  api: {
    baseUrl: 'http://localhost:3000/api',
    defaultCredentials: { username: 'dev@example.com', password: 'devpassword' },
    timeoutMs: 60000
  }
};
