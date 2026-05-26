import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import type { EnvironmentConfig } from '../../config/types';

export interface WebDriverOptions {
  headless?: boolean;
  slowMo?: number;
}

export class WebDriver {
  private _browser: Browser | null = null;
  private _context: BrowserContext | null = null;
  private _page: Page | null = null;

  constructor(private config: EnvironmentConfig) {}

  async launch(opts?: WebDriverOptions): Promise<void> {
    const browserName = this.config.web.browserName;
    const launcher = { chromium, firefox, webkit }[browserName];
    this._browser = await launcher.launch({
      headless: opts?.headless ?? this.config.web.headless,
      slowMo: opts?.slowMo ?? this.config.web.slowMo
    });
    this._context = await this._browser.newContext({
      baseURL: this.config.web.baseUrl,
      viewport: this.config.web.viewport ?? { width: 1280, height: 720 }
    });
    this._page = await this._context.newPage();
  }

  async close(): Promise<void> {
    await this._page?.close();
    await this._context?.close();
    await this._browser?.close();
    this._page = null;
    this._context = null;
    this._browser = null;
  }

  get page(): Page {
    if (!this._page) throw new Error('Browser not launched. Call launch() first.');
    return this._page;
  }

  get context(): BrowserContext {
    if (!this._context) throw new Error('Browser not launched. Call launch() first.');
    return this._context;
  }

  get browser(): Browser {
    if (!this._browser) throw new Error('Browser not launched. Call launch() first.');
    return this._browser;
  }

  get isLaunched(): boolean {
    return this._browser !== null;
  }

  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `reports/screenshots/${name}.png`, fullPage: true });
  }
}
