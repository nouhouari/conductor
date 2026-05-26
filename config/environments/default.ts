import type { EnvironmentConfig } from '../types';

export const defaultConfig: EnvironmentConfig = {
  name: 'default',
  web: {
    baseUrl: 'http://localhost:3000',
    headless: true,
    browserName: 'chromium'
  },
  api: {
    baseUrl: 'http://localhost:3000/api',
    defaultCredentials: { username: 'test@example.com', password: 'password' },
    timeoutMs: 30000
  },
  mobile: {
    flowsDir: 'example/flows/mobile',
    timeoutMs: 60000
  },
  database: {
    enabled: false
  }
};
