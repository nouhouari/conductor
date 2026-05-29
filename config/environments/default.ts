import type { EnvironmentConfig } from '../types';

export const defaultConfig: EnvironmentConfig = {
  name: 'default',
  web: {
    baseUrl: 'http://localhost:3000',
    headless: true,
    browserName: 'chromium'
  },
  api: {
    baseUrl: 'http://localhost:3000',
    defaultCredentials: { username: 'test@example.com', password: 'password' },
    timeoutMs: 30000
  },
  mobile: {
    flowsDir: 'flows/mobile',
    timeoutMs: 120000
  },
  database: {
    enabled: false
  },
  desktop: {
    agentJar: require('path').resolve(__dirname, '../../apps/desktop/agent/fxagent.jar'),
    defaultTimeoutMs: 10000,
    screenshotDir: 'reports/screenshots'
  }
};
