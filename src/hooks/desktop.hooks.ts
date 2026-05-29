import { After, Before, Status } from '@cucumber/cucumber';
import { ConductorWorld } from '../world/ConductorWorld';

Before({ tags: '@desktop or @cross-platform' }, async function (this: ConductorWorld) {
  this.logger.info('Desktop driver initialized for @desktop scenario');
});

After({ tags: '@desktop or @cross-platform' }, async function (this: ConductorWorld, scenario) {
  if (scenario.result?.status === Status.FAILED && this.isFxLaunched) {
    const name = scenario.pickle.name.replace(/\s+/g, '-').toLowerCase();
    const screenshot = await this.fx.takeScreenshot(`failure-${name}-${Date.now()}`);
    await this.attach(screenshot, 'image/png');
  }
  await this.closeFx();
});
