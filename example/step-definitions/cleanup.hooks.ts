import { Before } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor';

Before(async function (this: ConductorWorld) {
  if (!this.api.isInitialized) await this.api.init();
  const response = await this.api.get(`${this.config.api.baseUrl}/todos`);
  if (response.ok()) {
    const todos = await response.json() as Array<{ id: number }>;
    for (const todo of todos) {
      await this.api.delete(`${this.config.api.baseUrl}/todos/${todo.id}`);
    }
  }
});
