import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';
import { LoginPage } from '../pages/LoginPage';
import { TodoPage } from '../pages/TodoPage';

Given('I am on the todo web application', async function (this: ConductorWorld) {
  await this.page.goto(this.config.web.baseUrl);
});

When('I log in as {string} with password {string}', async function (this: ConductorWorld, username: string, password: string) {
  const loginPage = new LoginPage(this.page, this.config);
  await loginPage.login(username, password);
});

When('I create a todo titled {string}', async function (this: ConductorWorld, title: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.createTodo(title);
  this.data.lastTodoTitle = title;
});

When('I create a todo titled {string} with priority {string}', async function (this: ConductorWorld, title: string, priority: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.createTodo(title, priority);
  this.data.lastTodoTitle = title;
});

When('I edit the todo {string} to {string}', async function (this: ConductorWorld, currentTitle: string, newTitle: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.editTodo(currentTitle, newTitle);
  this.data.lastTodoTitle = newTitle;
});

When('I delete the todo {string}', async function (this: ConductorWorld, title: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.deleteTodo(title);
});

When('I toggle the todo {string}', async function (this: ConductorWorld, title: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.toggleTodo(title);
});

Then('the todo {string} appears on the web dashboard', async function (this: ConductorWorld, title: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.assertVisible(title);
});

Then('the todo {string} should not appear on the web dashboard', async function (this: ConductorWorld, title: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.assertNotVisible(title);
});

Then('the todo {string} should have status {string} on the web', async function (this: ConductorWorld, title: string, status: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.assertStatus(title, status);
});

Then('the todo {string} should have priority {string} on the web', async function (this: ConductorWorld, title: string, priority: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.assertPriority(title, priority);
});

Then('the web dashboard should show {int} todo(s)', async function (this: ConductorWorld, count: number) {
  const todoPage = new TodoPage(this.page, this.config);
  const actual = await todoPage.getTodoCount();
  if (actual !== count) throw new Error(`Expected ${count} todos but found ${actual}`);
});
