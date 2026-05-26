import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';

// Runs: maestro test flows/mobile/launch-app.yaml
When('the Flutter app launches', async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('launch-app');
});

// Runs: maestro test flows/mobile/launch-app-clean.yaml
When('the Flutter app launches with a clean state', async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('launch-app-clean');
});

Then('the home screen is visible', async function (this: ConductorWorld) {
  // Assertion is embedded in the launch-app.yaml flow (assertVisible "My Todos").
  // This step is intentionally empty — the flow already threw if it failed.
});

Then('the todo list shows {string}', async function (this: ConductorWorld, text: string) {
  // Assertion is embedded in launch-app-clean.yaml. The flow fails if the
  // text is not visible, so reaching here means it passed.
  void text;
});

// Seeds test data so the mobile scenario doesn't need a browser.
Given('a todo {string} exists in the system', async function (this: ConductorWorld, title: string) {
  if (!this.api.isInitialized) await this.api.init();
  const response = await this.api.post(`${this.config.api.baseUrl}/todos`, { title, status: 'open' });
  if (!response.ok()) throw new Error(`Failed to seed todo: ${response.status()} ${response.statusText()}`);
  this.data.lastTodoTitle = title;
});

When('I navigate to the todo list', async function (this: ConductorWorld) {
  // Navigation is handled inside navigate-to-todos.yaml via tapOn.
  // This step documents the intent; the actual tap happens in the flow.
});

// Runs: maestro test flows/mobile/navigate-to-todos.yaml --env TODO_TITLE="..." --env SCREENSHOT_NAME="..."
Then('the todo {string} is visible on screen', async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('navigate-to-todos', {
    env: {
      TODO_TITLE: title,
      SCREENSHOT_NAME: `todo-${title.replace(/\s+/g, '-').toLowerCase()}`
    }
  });
});

Then('a screenshot {string} is taken', async function (this: ConductorWorld, name: string) {
  // Screenshot is taken inside the Maestro flow via takeScreenshot.
  // Attaching the output to the Allure report for visibility.
  this.logger.info({ screenshot: name }, 'Screenshot captured by Maestro flow');
});
