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

export interface RemoteScenariosFilters {
  /** Story id or comma-separated ids (match any), e.g. "US-007". */
  story?: string;
  /** Requirement id or comma-separated ids; resolved via its stories, e.g. "REQ-001". */
  requirement?: string;
  /** Phase id; restricts to in-scope scenarios, e.g. "P1". */
  phase?: string;
  /** Phase resolution mode. Default 'cumulative'. */
  mode?: 'cumulative' | 'strict';
  /** Cucumber tag expression, e.g. "@smoke and not @wip". */
  tags?: string;
  /** Exact feature name. */
  feature?: string;
  /** Case-insensitive substring over name/feature/content. */
  q?: string;
  /** Filter by gherkin validity. */
  valid?: boolean;
}

export interface RemoteScenariosConfig {
  /** Base URL of the requ scenario API, e.g. "http://localhost:8788/api". */
  baseUrl: string;
  /** Project slug (required when the API has >1 project loaded). */
  project?: string;
  /** Server-side filters passed to GET /api/scenarios. */
  filters?: RemoteScenariosFilters;
  /** Directory where reconstructed .feature files are written. Default '.remote-features'. */
  outputDir: string;
}

export interface EnvironmentConfig {
  name: string;
  web: WebConfig;
  api: ApiConfig;
  mobile: MobileConfig;
  database: DatabaseConfig;
  desktop?: DesktopConfig;
  flutterDesktop?: FlutterDesktopConfig;
  /** Optional: source cucumber scenarios from the requ scenario API instead of local files. */
  remoteScenarios?: RemoteScenariosConfig;
}
