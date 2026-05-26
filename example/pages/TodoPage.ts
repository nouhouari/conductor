import { BasePage } from '../../src/pages/BasePage';
import type { Locator } from 'playwright';

export class TodoPage extends BasePage {
  private readonly titleInput: Locator;
  private readonly addButton: Locator;
  private readonly todoList: Locator;

  constructor(...args: ConstructorParameters<typeof BasePage>) {
    super(...args);
    this.titleInput = this.page.locator('[data-testid="todo-input"]');
    this.addButton = this.page.locator('[data-testid="todo-add"]');
    this.todoList = this.page.locator('[data-testid="todo-list"]');
  }

  async createTodo(title: string): Promise<void> {
    await this.titleInput.fill(title);
    await this.addButton.click();
    await this.page.waitForSelector(`text=${title}`);
  }

  async assertVisible(title: string): Promise<void> {
    await this.todoList.locator(`text=${title}`).waitFor({ state: 'visible' });
  }

  async getTodoCount(): Promise<number> {
    return this.todoList.locator('[data-testid="todo-item"]').count();
  }
}
