import { Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';
import * as fs from 'fs';
import * as path from 'path';

const MAESTRO_TIMEOUT = { timeout: 120000 };

Then('I take a screenshot {string}', MAESTRO_TIMEOUT, async function (this: ConductorWorld, name: string) {
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  const dir = 'reports/screenshots';
  fs.mkdirSync(dir, { recursive: true });

  if (this.web.isLaunched) {
    const screenshot = await this.web.takeScreenshot(slug);
    await this.attach(screenshot, 'image/png');
    this.logger.info({ path: `${dir}/${slug}.png` }, 'Web screenshot captured');
  }

  if (this.config.mobile.deviceId) {
    try {
      const screenshotPath = await this.maestro.takeScreenshot(slug);
      const buffer = fs.readFileSync(screenshotPath);
      await this.attach(buffer, 'image/png');
      this.logger.info({ path: screenshotPath }, 'Mobile screenshot captured');
    } catch {
      this.logger.warn('Mobile screenshot skipped — no device or Maestro unavailable');
    }
  }
});

Then('I take a web screenshot {string}', async function (this: ConductorWorld, name: string) {
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  fs.mkdirSync('reports/screenshots', { recursive: true });
  const screenshot = await this.web.takeScreenshot(slug);
  await this.attach(screenshot, 'image/png');
});

Then('I take a mobile screenshot {string}', MAESTRO_TIMEOUT, async function (this: ConductorWorld, name: string) {
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  fs.mkdirSync('reports/screenshots', { recursive: true });
  const screenshotPath = await this.maestro.takeScreenshot(slug);
  const buffer = fs.readFileSync(screenshotPath);
  await this.attach(buffer, 'image/png');
});
