import { After, Before } from '@cucumber/cucumber';
import { ConductorWorld } from '../world/ConductorWorld';

Before({ tags: '@database or @cross-platform' }, async function (this: ConductorWorld) {
  if (this.hasDb) await this.db.connect();
});

After({ tags: '@database or @cross-platform' }, async function (this: ConductorWorld) {
  await this.disconnectDb();
});
