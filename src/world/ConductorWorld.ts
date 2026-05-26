import { IWorldOptions, World } from '@cucumber/cucumber';
import { Page, APIRequestContext } from 'playwright';
import { config } from '../../config';
import type { EnvironmentConfig } from '../../config/types';
import { WebDriver } from '../drivers/WebDriver';
import { ApiDriver } from '../drivers/ApiDriver';
import { MaestroDriver } from '../drivers/MaestroDriver';
import { DatabaseDriver } from '../drivers/DatabaseDriver';
import { createLogger } from '../support/logger';

export class ConductorWorld extends World {
  readonly config: EnvironmentConfig = config;
  readonly logger = createLogger('conductor');
  readonly data: Record<string, unknown> = {};

  private _webDriver: WebDriver | null = null;
  private _apiDriver: ApiDriver | null = null;
  private _maestroDriver: MaestroDriver | null = null;
  private _dbDriver: DatabaseDriver | null = null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  // Web

  get web(): WebDriver {
    if (!this._webDriver) this._webDriver = new WebDriver(this.config);
    return this._webDriver;
  }

  get page(): Page {
    return this.web.page;
  }

  // API

  get api(): ApiDriver {
    if (!this._apiDriver) this._apiDriver = new ApiDriver(this.config);
    return this._apiDriver;
  }

  get request(): APIRequestContext {
    return this.api.client;
  }

  // Mobile

  get maestro(): MaestroDriver {
    if (!this._maestroDriver) this._maestroDriver = new MaestroDriver(this.config);
    return this._maestroDriver;
  }

  // Database (plugin — user registers their adapter)

  setDb(driver: DatabaseDriver): void {
    this._dbDriver = driver;
  }

  get db(): DatabaseDriver {
    if (!this._dbDriver) throw new Error('No DatabaseDriver registered. Call world.setDb(adapter) in a Before hook.');
    return this._dbDriver;
  }

  get hasDb(): boolean {
    return this._dbDriver !== null;
  }

  // Tear-down helpers (called by hooks)

  async closeWeb(): Promise<void> {
    await this._webDriver?.close();
    this._webDriver = null;
  }

  async disposeApi(): Promise<void> {
    await this._apiDriver?.dispose();
    this._apiDriver = null;
  }

  async disconnectDb(): Promise<void> {
    if (this._dbDriver) {
      await this._dbDriver.disconnect();
      this._dbDriver = null;
    }
  }
}
