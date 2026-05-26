import { APIRequestContext, APIResponse, BrowserContext, request as playwrightRequest } from 'playwright';
import type { EnvironmentConfig } from '../../config/types';

export class ApiDriver {
  private _client: APIRequestContext | null = null;

  constructor(private config: EnvironmentConfig) {}

  async init(context?: BrowserContext): Promise<void> {
    if (context) {
      this._client = context.request;
    } else {
      this._client = await playwrightRequest.newContext({
        baseURL: this.config.api.baseUrl,
        extraHTTPHeaders: { 'Content-Type': 'application/json' }
      });
    }
  }

  get client(): APIRequestContext {
    if (!this._client) throw new Error('ApiDriver not initialized. Call init() first.');
    return this._client;
  }

  get isInitialized(): boolean {
    return this._client !== null;
  }

  async get(url: string, options?: Record<string, unknown>): Promise<APIResponse> {
    return this.client.get(url, options);
  }

  async post(url: string, data?: unknown, options?: Record<string, unknown>): Promise<APIResponse> {
    return this.client.post(url, { data, ...options });
  }

  async put(url: string, data?: unknown, options?: Record<string, unknown>): Promise<APIResponse> {
    return this.client.put(url, { data, ...options });
  }

  async delete(url: string, options?: Record<string, unknown>): Promise<APIResponse> {
    return this.client.delete(url, options);
  }

  async dispose(): Promise<void> {
    await this._client?.dispose();
    this._client = null;
  }
}
