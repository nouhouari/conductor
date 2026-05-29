import { BasePage } from 'conductor-e2e';
import type { Locator } from 'playwright';

export class TodoPage extends BasePage {
  private readonly titleInput: Locator;
  private readonly addButton: Locator;
  private readonly todoList: Locator;
  private readonly prioritySelect: Locator;

  constructor(...args: ConstructorParameters<typeof BasePage>) {
    super(...args);
    this.titleInput = this.page.locator('[data-testid="todo-input"]');
    this.addButton = this.page.locator('[data-testid="todo-add"]');
    this.todoList = this.page.locator('[data-testid="todo-list"]');
    this.prioritySelect = this.page.locator('[data-testid="todo-priority-select"]');
  }

  async createTodo(title: string, priority?: string): Promise<void> {
    await this.titleInput.fill(title);
    if (priority) {
      await this.prioritySelect.selectOption(priority);
    }
    await this.addButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async assertVisible(title: string): Promise<void> {
    await this.todoList.locator(`text=${title}`).waitFor({ state: 'visible' });
  }

  async assertNotVisible(title: string): Promise<void> {
    await this.todoList.locator(`text=${title}`).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    const count = await this.todoList.locator(`[data-testid="todo-item"]`).filter({ hasText: title }).count();
    if (count > 0) throw new Error(`Todo "${title}" is still visible but should not be`);
  }

  async getTodoCount(): Promise<number> {
    return this.todoList.locator('[data-testid="todo-item"]').count();
  }

  private getTodoItem(title: string): Locator {
    return this.todoList.locator('[data-testid="todo-item"]').filter({ hasText: title });
  }

  async editTodo(currentTitle: string, newTitle: string): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept(newTitle);
    });
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      this.getTodoItem(currentTitle).locator('[data-testid="todo-edit"]').click(),
    ]);
  }

  async deleteTodo(title: string): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      this.getTodoItem(title).locator('[data-testid="todo-delete"]').click(),
    ]);
  }

  async toggleTodo(title: string): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      this.getTodoItem(title).locator('[data-testid="todo-toggle"]').click(),
    ]);
  }

  async assertStatus(title: string, status: string): Promise<void> {
    const item = this.getTodoItem(title);
    await item.locator(`.todo-status`).waitFor({ state: 'visible' });
    const text = await item.locator(`.todo-status`).textContent();
    if (!text?.includes(status)) {
      throw new Error(`Expected todo "${title}" to have status "${status}" but got "${text}"`);
    }
  }

  async assertPriority(title: string, priority: string): Promise<void> {
    const item = this.getTodoItem(title);
    const text = await item.locator('[data-testid="todo-priority"]').textContent();
    if (text?.trim() !== priority) {
      throw new Error(`Expected todo "${title}" to have priority "${priority}" but got "${text}"`);
    }
  }

}
