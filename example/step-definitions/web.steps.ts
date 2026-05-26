import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from '../../src/world/ConductorWorld';
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

Then('the todo {string} appears on the web dashboard', async function (this: ConductorWorld, title: string) {
  const todoPage = new TodoPage(this.page, this.config);
  await todoPage.assertVisible(title);
});
