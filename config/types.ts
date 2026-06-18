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

export interface FlutterDesktopConfig {
  /** Absolute path to the built executable (.app bundle on macOS, .exe on Windows). */
  appPath: string;
  /** Per-action timeout, ms. Default 10_000. */
  defaultTimeoutMs?: number;
  /** How long to wait for the VM service URL to appear on stdout. Default 30_000. */
  launchTimeoutMs?: number;
  /** Optional fixed VM service port (passed via --vm-service-port=). Default: ephemeral. */
  vmServicePort?: number;
  /** Extra CLI args appended after the executable. */
  extraArgs?: string[];
  /** Environment variables added to the spawned process. */
  env?: Record<string, string>;
  /** Where failure screenshots are written. Default 'reports/screenshots'. */
  screenshotDir?: string;
}

export interface EnvironmentConfig {
  name: string;
  web: WebConfig;
  api: ApiConfig;
  mobile: MobileConfig;
  database: DatabaseConfig;
  desktop?: DesktopConfig;
  flutterDesktop?: FlutterDesktopConfig;
}
