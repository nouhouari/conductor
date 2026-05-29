import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';
import * as path from 'path';

const DESKTOP_TIMEOUT = { timeout: 60000 };

interface TodoResponse {
  id: number;
  title: string;
  status: string;
  priority: string;
}

async function ensureApi(world: ConductorWorld): Promise<void> {
  if (!world.api.isInitialized) await world.api.init();
}

async function findTodoIdByTitle(world: ConductorWorld, title: string): Promise<number> {
  await ensureApi(world);
  const response = await world.api.get(`${world.config.api.baseUrl}/todos`);
  const todos = await response.json() as TodoResponse[];
  const todo = todos.find(t => t.title === title);
  if (!todo) throw new Error(`Todo "${title}" not found via API`);
  return todo.id;
}

Given('the desktop app is running', DESKTOP_TIMEOUT, async function (this: ConductorWorld) {
  const jarPath = path.resolve('../apps/desktop/build/libs/todoapp-desktop-all.jar');
  const apiUrl = process.env.API_BASE_URL_FOR_DESKTOP ?? this.config.api.baseUrl;
  this.logger.info({ jarPath, apiUrl, agentJar: this.config.desktop?.agentJar }, 'Launching desktop app');
  try {
    await this.fx.launch({
      app: 'com.example.todoapp.Launcher',
      classpath: jarPath,
      jvmArgs: [`-DAPI_BASE_URL=${apiUrl}`],
      readyTimeoutMs: 30000,
    });
  } catch (e: any) {
    this.logger.error({ error: e.message, stack: e.stack, details: e.details }, 'Desktop launch failed');
    throw e;
  }
  await this.fx.locator('#todo-input').waitFor({ state: 'visible', timeout: 15000 });
});

When('I create a todo {string} with priority {string} via the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, title: string, priority: string) {
  await this.fx.locator('#todo-input').fill(title);
  await this.fx.locator('#todo-priority-select').selectOption(priority);
  await this.fx.locator('#todo-add').click();
  await this.fx.locator(`text=${title}`).waitFor({ state: 'visible' });
  this.data.lastTodoTitle = title;
});

When('I create a todo {string} via the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.fx.locator('#todo-input').fill(title);
  await this.fx.locator('#todo-add').click();
  await this.fx.locator(`text=${title}`).waitFor({ state: 'visible' });
  this.data.lastTodoTitle = title;
});

async function refreshDesktop(world: ConductorWorld): Promise<void> {
  await world.fx.locator('#refresh-btn').click();
}

When('I edit the todo {string} to {string} via the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, currentTitle: string, newTitle: string) {
  const id = await findTodoIdByTitle(this, currentTitle);
  await refreshDesktop(this);
  await this.fx.locator(`#edit-${id}`).waitFor({ state: 'visible', timeout: 10000 });
  await this.fx.locator(`#edit-${id}`).click();
  await this.fx.locator('text=OK').waitFor({ state: 'visible', timeout: 5000 });
  // Dialog's text field uses .text-input style class — query all and pick the focused one (dialog field)
  await this.fx.locator('css=.dialog-pane .text-input').setText(newTitle);
  await this.fx.locator('text=OK').click();
  await this.fx.locator(`text=${newTitle}`).waitFor({ state: 'visible' });
  await new Promise(r => setTimeout(r, 500));
});

When('I toggle the todo {string} via the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  const id = await findTodoIdByTitle(this, title);
  await refreshDesktop(this);
  await this.fx.locator(`#toggle-${id}`).waitFor({ state: 'visible', timeout: 10000 });
  await this.fx.locator(`#toggle-${id}`).click();
  // Wait for the async PUT to complete server-side
  await new Promise(r => setTimeout(r, 800));
});

When('I delete the todo {string} via the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  const id = await findTodoIdByTitle(this, title);
  await refreshDesktop(this);
  await this.fx.locator(`#delete-${id}`).waitFor({ state: 'visible', timeout: 10000 });
  await this.fx.locator(`#delete-${id}`).click();
  await this.fx.locator('text=OK').waitFor({ state: 'visible', timeout: 5000 });
  await this.fx.locator('text=OK').click();
});

Then('the todo {string} should be visible on the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.fx.locator(`text=${title}`).waitFor({ state: 'visible' });
});

Then('the todo {string} should not be visible on the desktop app', DESKTOP_TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.fx.locator(`text=${title}`).waitFor({ state: 'hidden', timeout: 5000 });
});

Then('I take a desktop screenshot {string}', DESKTOP_TIMEOUT, async function (this: ConductorWorld, name: string) {
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  try {
    const buffer = await this.fx.screenshot(slug);
    await this.attach(buffer, 'image/png');
  } catch (e: any) {
    this.logger.warn({ error: e.message }, 'Desktop screenshot failed');
  }
});
