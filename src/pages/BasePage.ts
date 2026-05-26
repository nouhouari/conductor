import { Page } from 'playwright';
import type { EnvironmentConfig } from '../../config/types';

export abstract class BasePage {
  constructor(protected page: Page, protected config: EnvironmentConfig) {}

  async navigate(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }
}
