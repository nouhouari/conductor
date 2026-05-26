import type { EnvironmentConfig } from '../types';

export const stagingConfig: Partial<EnvironmentConfig> = {
  name: 'staging',
  web: {
    baseUrl: 'https://staging.example.com',
    headless: true,
    browserName: 'chromium'
  },
  api: {
    baseUrl: 'https://staging.example.com/api',
    defaultCredentials: { username: 'staging@example.com', password: 'stagingpassword' },
    timeoutMs: 45000
  }
};
