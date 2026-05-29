import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';

interface TodoResponse {
  id: number;
  title: string;
  status: string;
  priority: string;
}

async function ensureApi(world: ConductorWorld): Promise<void> {
  if (!world.api.isInitialized) {
    if (world.web.isLaunched) {
      await world.api.init(world.web.context);
    } else {
      await world.api.init();
    }
  }
}

Given('a todo {string} exists via the API', async function (this: ConductorWorld, title: string) {
  await ensureApi(this);
  const response = await this.api.post(`${this.config.api.baseUrl}/todos`, { title, status: 'open' });
  if (!response.ok()) throw new Error(`Failed to create todo: ${response.status()} ${response.statusText()}`);
  const todo = await response.json() as TodoResponse;
  this.data.lastTodoId = todo.id;
  this.data.lastTodoTitle = title;
});

Given('a todo {string} with priority {string} exists via the API', async function (this: ConductorWorld, title: string, priority: string) {
  await ensureApi(this);
  const response = await this.api.post(`${this.config.api.baseUrl}/todos`, { title, status: 'open', priority });
  if (!response.ok()) throw new Error(`Failed to create todo: ${response.status()} ${response.statusText()}`);
  const todo = await response.json() as TodoResponse;
  this.data.lastTodoId = todo.id;
  this.data.lastTodoTitle = title;
});

When('I create a todo {string} via the API', async function (this: ConductorWorld, title: string) {
  await ensureApi(this);
  const response = await this.api.post(`${this.config.api.baseUrl}/todos`, { title, status: 'open' });
  if (!response.ok()) throw new Error(`Failed to create todo: ${response.status()} ${response.statusText()}`);
  const todo = await response.json() as TodoResponse;
  this.data.lastTodoId = todo.id;
  this.data.lastTodoTitle = title;
});

When('I create a todo {string} with priority {string} via the API', async function (this: ConductorWorld, title: string, priority: string) {
  await ensureApi(this);
  const response = await this.api.post(`${this.config.api.baseUrl}/todos`, { title, status: 'open', priority });
  if (!response.ok()) throw new Error(`Failed to create todo: ${response.status()} ${response.statusText()}`);
  const todo = await response.json() as TodoResponse;
  this.data.lastTodoId = todo.id;
  this.data.lastTodoTitle = title;
});

When('I update the todo {string} title to {string} via the API', async function (this: ConductorWorld, currentTitle: string, newTitle: string) {
  await ensureApi(this);
  const todos = await (await this.api.get(`${this.config.api.baseUrl}/todos`)).json() as TodoResponse[];
  const todo = todos.find(t => t.title === currentTitle);
  if (!todo) throw new Error(`Todo "${currentTitle}" not found`);
  const response = await this.api.put(`${this.config.api.baseUrl}/todos/${todo.id}`, { title: newTitle });
  if (!response.ok()) throw new Error(`Failed to update todo: ${response.status()} ${response.statusText()}`);
  this.data.lastTodoId = todo.id;
  this.data.lastTodoTitle = newTitle;
});

When('I update the todo {string} status to {string} via the API', async function (this: ConductorWorld, title: string, status: string) {
  await ensureApi(this);
  const todos = await (await this.api.get(`${this.config.api.baseUrl}/todos`)).json() as TodoResponse[];
  const todo = todos.find(t => t.title === title);
  if (!todo) throw new Error(`Todo "${title}" not found`);
  const response = await this.api.put(`${this.config.api.baseUrl}/todos/${todo.id}`, { status });
  if (!response.ok()) throw new Error(`Failed to update todo: ${response.status()} ${response.statusText()}`);
});

When('I update the todo {string} priority to {string} via the API', async function (this: ConductorWorld, title: string, priority: string) {
  await ensureApi(this);
  const todos = await (await this.api.get(`${this.config.api.baseUrl}/todos`)).json() as TodoResponse[];
  const todo = todos.find(t => t.title === title);
  if (!todo) throw new Error(`Todo "${title}" not found`);
  const response = await this.api.put(`${this.config.api.baseUrl}/todos/${todo.id}`, { priority });
  if (!response.ok()) throw new Error(`Failed to update todo: ${response.status()} ${response.statusText()}`);
});

When('I delete the todo {string} via the API', async function (this: ConductorWorld, title: string) {
  await ensureApi(this);
  const todos = await (await this.api.get(`${this.config.api.baseUrl}/todos`)).json() as TodoResponse[];
  const todo = todos.find(t => t.title === title);
  if (!todo) throw new Error(`Todo "${title}" not found`);
  const response = await this.api.delete(`${this.config.api.baseUrl}/todos/${todo.id}`);
  if (response.status() !== 204) throw new Error(`Failed to delete todo: ${response.status()} ${response.statusText()}`);
});

Then('the API should return the todo {string} with status {string}', async function (this: ConductorWorld, title: string, status: string) {
  await ensureApi(this);
  const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
  if (!response.ok()) throw new Error(`API returned ${response.status()}: ${response.statusText()}`);
  const todos = await response.json() as TodoResponse[];
  const found = todos.find((t) => t.title === title);
  if (!found) throw new Error(`Todo "${title}" not found in API response`);
  if (found.status !== status) throw new Error(`Expected status "${status}" but got "${found.status}"`);
});

Then('the API should return the todo {string} with priority {string}', async function (this: ConductorWorld, title: string, priority: string) {
  await ensureApi(this);
  const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
  if (!response.ok()) throw new Error(`API returned ${response.status()}: ${response.statusText()}`);
  const todos = await response.json() as TodoResponse[];
  const found = todos.find((t) => t.title === title);
  if (!found) throw new Error(`Todo "${title}" not found in API response`);
  if (found.priority !== priority) throw new Error(`Expected priority "${priority}" but got "${found.priority}"`);
});

Then('the API should not return a todo {string}', async function (this: ConductorWorld, title: string) {
  await ensureApi(this);
  const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
  if (!response.ok()) throw new Error(`API returned ${response.status()}: ${response.statusText()}`);
  const todos = await response.json() as TodoResponse[];
  const found = todos.find((t) => t.title === title);
  if (found) throw new Error(`Todo "${title}" should not exist but was found`);
});

Then('the API should return {int} todo(s)', async function (this: ConductorWorld, count: number) {
  await ensureApi(this);
  const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
  if (!response.ok()) throw new Error(`API returned ${response.status()}: ${response.statusText()}`);
  const todos = await response.json() as TodoResponse[];
  if (todos.length !== count) throw new Error(`Expected ${count} todos but got ${todos.length}`);
});
