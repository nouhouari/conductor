import { After, Before, Status } from '@cucumber/cucumber';
import { ConductorWorld } from '../world/ConductorWorld';

Before({ tags: '@flutter-desktop or @cross-platform' }, async function (this: ConductorWorld) {
  // Lazy: many @cross-platform scenarios won't actually exercise Flutter desktop;
  // we don't pre-launch here. Step definitions call `await this.flutterDesktop.launch()`
  // when needed. This keeps non-flutter scenarios fast.
  if (this.config.flutterDesktop) {
    this.logger.info(`FlutterDesktopDriver available: ${this.config.flutterDesktop.appPath}`);
  }
});

After({ tags: '@flutter-desktop or @cross-platform' }, async function (this: ConductorWorld, scenario) {
  if (scenario.result?.status === Status.FAILED && this.isFlutterDesktopLaunched) {
    try {
      const name = scenario.pickle.name.replace(/\s+/g, '-').toLowerCase();
      const screenshot = await this.flutterDesktop.takeScreenshot(`failure-${name}-${Date.now()}`);
      const buf = require('fs').readFileSync(screenshot);
      await this.attach(buf, 'image/png');
    } catch (err) {
      this.logger.warn(`Failed to capture FlutterDesktop screenshot: ${(err as Error).message}`);
    }
  }
  await this.closeFlutterDesktop();
});
