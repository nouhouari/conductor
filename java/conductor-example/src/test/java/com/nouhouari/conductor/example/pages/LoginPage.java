package com.nouhouari.conductor.example.pages;

import com.microsoft.playwright.Page;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.pages.BasePage;

/** Java port of example/pages/LoginPage.ts. */
public class LoginPage extends BasePage {

    private final com.microsoft.playwright.Locator usernameInput;
    private final com.microsoft.playwright.Locator passwordInput;
    private final com.microsoft.playwright.Locator submitButton;

    public LoginPage(Page page, EnvironmentConfig config) {
        super(page, config);
        this.usernameInput = page.locator("[data-testid=\"username\"]");
        this.passwordInput = page.locator("[data-testid=\"password\"]");
        this.submitButton = page.locator("[data-testid=\"login-submit\"]");
    }

    public void fillUsername(String username) {
        usernameInput.fill(username);
    }

    public void fillPassword(String password) {
        passwordInput.fill(password);
    }

    public void submit() {
        submitButton.click();
        waitForLoad();
    }

    public void login(String username, String password) {
        navigate("/login");
        fillUsername(username);
        fillPassword(password);
        submit();
    }
}
