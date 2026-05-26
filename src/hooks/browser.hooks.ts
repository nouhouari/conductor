import { After, Before, Status } from '@cucumber/cucumber';
import { ConductorWorld } from '../world/ConductorWorld';

Before({ tags: '@web or @cross-platform' }, async function (this: ConductorWorld) {
  await this.web.launch();
});

After({ tags: '@web or @cross-platform' }, async function (this: ConductorWorld, scenario) {
  if (scenario.result?.status === Status.FAILED && this.web.isLaunched) {
    const name = scenario.pickle.name.replace(/\s+/g, '-').toLowerCase();
    const screenshot = await this.web.takeScreenshot(`failure-${name}-${Date.now()}`);
    await this.attach(screenshot, 'image/png');
  }
  await this.closeWeb();
});
