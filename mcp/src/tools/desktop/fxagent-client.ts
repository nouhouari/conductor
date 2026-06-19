export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4567;
const REQUEST_TIMEOUT_MS = 10_000;

export class FxAgentConnectionError extends Error {
  constructor(host: string, port: number) {
    super(
      `Cannot connect to fxagent at ${host}:${port} — ` +
      `is the app running with -javaagent:fxagent.jar?`,
    );
    this.name = 'FxAgentConnectionError';
  }
}

export class FxAgentProtocolError extends Error {
  constructor(
    public readonly status: number,
    endpoint: string,
    detail?: string,
  ) {
    super(
      `fxagent returned HTTP ${status} for ${endpoint}` +
      (detail ? `: ${detail}` : ''),
    );
    this.name = 'FxAgentProtocolError';
  }
}

// ---- Raw response shapes from fxagent ----

export interface SceneTreeResponse {
  windows: Array<{
    windowIndex: number;
    windowType: string;
    root: ElementNode | Record<string, never>;
  }>;
}

export interface ElementNode {
  handle: string;
  id: string | null;
  type: string;
  fullType: string;
  styleClasses: string[];
  text: string | null;
  bounds: { x: number; y: number; width: number; height: number } | null;
  visible: boolean;
  enabled: boolean;
  focused: boolean;
  properties: Record<string, unknown> | null;
  children?: ElementNode[];
}

export interface QueryResponse {
  elements: ElementNode[];
  count: number;
}

export interface ActionResponse {
  success: boolean;
  message: string;
  element?: ElementNode;
}

export interface ScreenshotResponse {
  data: string;   // base64-encoded PNG (field name confirmed from ScreenshotController.java)
  format: string;
  width: number;
  height: number;
}

// ---- Client ----

export class FxAgentClient {
  private readonly baseUrl: string;
  private readonly host: string;
  private readonly port: number;

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    this.host = host;
    this.port = port;
    this.baseUrl = `http://${host}:${port}`;
  }

  async getSceneTree(depth: number): Promise<SceneTreeResponse> {
    return this.get<SceneTreeResponse>(`/api/v1/scene/tree?depth=${depth}`);
  }

  async getElementSubtree(handle: string, depth: number): Promise<ElementNode> {
    return this.get<ElementNode>(
      `/api/v1/elements/${encodeURIComponent(handle)}/tree?depth=${depth}`,
    );
  }

  async queryElements(
    selector: string,
    maxResults: number,
    windowIndex?: number,
  ): Promise<QueryResponse> {
    const body: Record<string, unknown> = { selector, maxResults };
    if (windowIndex !== undefined) body.windowIndex = windowIndex;
    return this.post<QueryResponse>('/api/v1/elements/query', body);
  }

  async performAction(
    selector: string,
    action: string,
    value?: string,
  ): Promise<ActionResponse> {
    const body: Record<string, unknown> = { selector, action };
    if (value !== undefined) body.value = value;
    return this.post<ActionResponse>('/api/v1/actions', body);
  }

  async waitForElement(
    selector: string,
    condition: string,
    timeoutMs: number,
  ): Promise<ElementNode> {
    return this.post<ElementNode>('/api/v1/elements/wait', {
      selector,
      condition,
      timeoutMs,
      pollIntervalMs: 200,
    });
  }

  async captureScreenshot(opts: {
    selector?: string;
    windowIndex?: number;
  }): Promise<ScreenshotResponse> {
    return this.post<ScreenshotResponse>('/api/v1/screenshot', opts);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {};
      let requestBody: string | undefined;
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }

      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      const responseText = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = responseText;
      }

      if (!response.ok) {
        const detail =
          typeof parsed === 'object' && parsed !== null && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : typeof parsed === 'string' && parsed.length > 0
              ? parsed.slice(0, 200)
              : undefined;
        throw new FxAgentProtocolError(response.status, path, detail);
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof FxAgentProtocolError) throw err;

      const e = err as NodeJS.ErrnoException & { name?: string };
      if (
        e.name === 'AbortError' ||
        e.code === 'ECONNREFUSED' ||
        e.code === 'ECONNRESET' ||
        e.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        (e.cause instanceof Error && (e.cause as NodeJS.ErrnoException).code === 'ECONNREFUSED')
      ) {
        throw new FxAgentConnectionError(this.host, this.port);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
