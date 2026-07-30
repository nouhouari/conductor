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

  /**
   * Poll `/api/v1/elements/query` client-side until `selector` reaches `state`.
   *
   * fxagent's own `/api/v1/elements/wait` can only ever *find* an element: when
   * nothing matches it answers HTTP 500 (`INTERNAL_ERROR … parameter obj is
   * null`), so it cannot express `hidden`/`disabled`/absent. Verified against
   * fxagent 0.3.0. The npm `javafx-driver` package polls the query endpoint for
   * exactly this reason — we mirror that here.
   *
   * @returns the matching element, or `null` for states satisfied by absence.
   */
  async waitForState(
    selector: string,
    state: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'exists',
    timeoutMs: number,
    pollIntervalMs = 200,
  ): Promise<{ satisfied: boolean; element: ElementNode | null }> {
    const deadline = Date.now() + timeoutMs;
    let last: ElementNode | null = null;

    for (;;) {
      last = await this.firstMatch(selector);
      if (matchesState(last, state)) {
        return { satisfied: true, element: last };
      }
      if (Date.now() >= deadline) {
        return { satisfied: false, element: last };
      }
      await delay(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    }
  }

  /** Single-element query; returns null when the selector matches nothing. */
  private async firstMatch(selector: string): Promise<ElementNode | null> {
    try {
      const response = await this.queryElements(selector, 1);
      return response.elements?.[0] ?? null;
    } catch (err) {
      // A selector that matches nothing may surface as a protocol error
      // depending on the agent build — treat it as "not present".
      if (err instanceof FxAgentProtocolError) return null;
      throw err;
    }
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

/** Whether a query result satisfies a wait state. */
function matchesState(
  element: ElementNode | null,
  state: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'exists',
): boolean {
  switch (state) {
    case 'visible':
      return element !== null && element.visible;
    case 'hidden':
      // Satisfied both by an absent node and by a present-but-invisible one.
      return element === null || !element.visible;
    case 'enabled':
      return element !== null && element.visible && element.enabled;
    case 'disabled':
      return element !== null && !element.enabled;
    case 'exists':
      return element !== null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
