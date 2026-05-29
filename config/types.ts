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

export interface DesktopConfig {
  agentJar: string;
  javaBin?: string;
  agentPort?: number;
  agentHost?: string;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
  screenshotDir?: string;
  jvmArgs?: string[];
}

export interface EnvironmentConfig {
  name: string;
  web: WebConfig;
  api: ApiConfig;
  mobile: MobileConfig;
  database: DatabaseConfig;
  desktop?: DesktopConfig;
}
