import { BasePage } from 'conductor';
import type { Locator } from 'playwright';

export class LoginPage extends BasePage {
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(...args: ConstructorParameters<typeof BasePage>) {
    super(...args);
    this.usernameInput = this.page.locator('[data-testid="username"]');
    this.passwordInput = this.page.locator('[data-testid="password"]');
    this.submitButton = this.page.locator('[data-testid="login-submit"]');
  }

  async fillUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoad();
  }

  async login(username: string, password: string): Promise<void> {
    await this.navigate('/login');
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.submit();
  }
}
