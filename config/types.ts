export interface WebConfig {
  baseUrl: string;
  headless: boolean;
  browserName: 'chromium' | 'firefox' | 'webkit';
  slowMo?: number;
  viewport?: { width: number; height: number };
}

export interface ApiConfig {
  baseUrl: string;
  defaultCredentials: { username: string; password: string };
  timeoutMs?: number;
}

export interface MobileConfig {
  deviceId?: string;
  flowsDir: string;
  timeoutMs: number;
  maestroBin?: string;
}

export interface DatabaseConfig {
  enabled: boolean;
}

export interface EnvironmentConfig {
  name: string;
  web: WebConfig;
  api: ApiConfig;
  mobile: MobileConfig;
  database: DatabaseConfig;
}
