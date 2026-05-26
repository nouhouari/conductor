import { Then } from '@cucumber/cucumber';
import { ConductorWorld } from '../../src/world/ConductorWorld';

Then('the API should return the todo {string} with status {string}', async function (this: ConductorWorld, title: string, status: string) {
  if (!this.api.isInitialized) await this.api.init(this.web.context);
  const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
  if (!response.ok()) throw new Error(`API returned ${response.status()}: ${response.statusText()}`);
  const todos = await response.json() as Array<{ title: string; status: string }>;
  const found = todos.find((t) => t.title === title);
  if (!found) throw new Error(`Todo "${title}" not found in API response`);
  if (found.status !== status) throw new Error(`Expected status "${status}" but got "${found.status}"`);
});
