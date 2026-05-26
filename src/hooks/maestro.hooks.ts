import { Before } from '@cucumber/cucumber';
import { ConductorWorld } from '../world/ConductorWorld';

Before({ tags: '@mobile or @cross-platform' }, async function (this: ConductorWorld) {
  const deviceId = this.config.mobile.deviceId ?? 'default';
  this.logger.info({ deviceId }, 'Targeting Maestro device');
});
