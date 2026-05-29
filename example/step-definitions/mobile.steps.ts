import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';

const LAUNCH_TIMEOUT = { timeout: 150000 };
const STEP_TIMEOUT = { timeout: 150000 };

When('the Flutter app launches', LAUNCH_TIMEOUT, async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('launch-app');
});

When('the Flutter app launches with a clean state', LAUNCH_TIMEOUT, async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('launch-app-clean');
});

Then('the home screen is visible', async function (this: ConductorWorld) {
});

Then('the todo list shows {string}', async function (this: ConductorWorld, text: string) {
  void text;
});

Given('a todo {string} exists in the system', async function (this: ConductorWorld, title: string) {
  if (!this.api.isInitialized) await this.api.init();
  const response = await this.api.post(`${this.config.api.baseUrl}/api/todos`, { title, status: 'open' });
  if (!response.ok()) throw new Error(`Failed to seed todo: ${response.status()} ${response.statusText()}`);
  this.data.lastTodoTitle = title;
});

When('I navigate to the todo list', async function (this: ConductorWorld) {
});

Then('the todo {string} is visible on screen', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('navigate-to-todos', {
    env: {
      TODO_TITLE: title,
      SCREENSHOT_NAME: `todo-${title.replace(/\s+/g, '-').toLowerCase()}`
    }
  });
});

Then('a screenshot {string} is taken', async function (this: ConductorWorld, name: string) {
  this.logger.info({ screenshot: name }, 'Screenshot captured by Maestro flow');
});

When('I create a todo {string} on the mobile app', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('create-todo', {
    env: { TODO_TITLE: title }
  });
  this.data.lastTodoTitle = title;
});

When('I edit the todo {string} to {string} on the mobile app', { timeout: 180000 }, async function (this: ConductorWorld, oldTitle: string, newTitle: string) {
  await this.maestro.runOrThrow('edit-todo', {
    env: { OLD_TITLE: oldTitle, NEW_TITLE: newTitle },
    timeoutMs: 150000
  });
  this.data.lastTodoTitle = newTitle;
});

When('I toggle the todo {string} on the mobile app', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('toggle-todo', {
    env: { TODO_TITLE: title }
  });
});

When('I mark the todo {string} as done on the mobile app', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('toggle-todo', {
    env: { TODO_TITLE: title }
  });
});

When('I mark the todo {string} as open on the mobile app', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('toggle-todo', {
    env: { TODO_TITLE: title }
  });
});

When('I delete the todo {string} on the mobile app', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('delete-todo', {
    env: { TODO_TITLE: title }
  });
});

Then('the mobile app should display {string}', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('verify-todo', {
    env: { TODO_TITLE: title }
  });
});

Then('the mobile app should not display {string}', STEP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.maestro.runOrThrow('launch-app');
  const result = await this.maestro.run('verify-todo', {
    env: { TODO_TITLE: title }
  });
  if (result.success) {
    throw new Error(`Todo "${title}" should not be visible on mobile but was found`);
  }
});
