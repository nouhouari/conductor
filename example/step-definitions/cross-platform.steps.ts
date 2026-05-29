import { Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';

Then('the Flutter app should display {string} in the todo list', { timeout: 120000 }, async function (this: ConductorWorld, title: string) {
  const result = await this.maestro.runOrThrow('verify-todo', {
    env: { TODO_TITLE: title }
  });
  this.logger.info({ output: result.output }, 'Maestro run complete');
});
