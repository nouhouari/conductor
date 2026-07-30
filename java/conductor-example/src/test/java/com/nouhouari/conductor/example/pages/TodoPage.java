package com.nouhouari.conductor.example.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitForSelectorState;
import com.microsoft.playwright.options.WaitUntilState;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.pages.BasePage;

/** Java port of example/pages/TodoPage.ts. */
public class TodoPage extends BasePage {

    private final Locator titleInput;
    private final Locator addButton;
    private final Locator todoList;
    private final Locator prioritySelect;

    public TodoPage(Page page, EnvironmentConfig config) {
        super(page, config);
        this.titleInput = page.locator("[data-testid=\"todo-input\"]");
        this.addButton = page.locator("[data-testid=\"todo-add\"]");
        this.todoList = page.locator("[data-testid=\"todo-list\"]");
        this.prioritySelect = page.locator("[data-testid=\"todo-priority-select\"]");
    }

    public void createTodo(String title) {
        createTodo(title, null);
    }

    public void createTodo(String title, String priority) {
        titleInput.fill(title);
        if (priority != null) {
            prioritySelect.selectOption(priority);
        }
        addButton.click();
        page.waitForLoadState(LoadState.NETWORKIDLE);
    }

    public void assertVisible(String title) {
        todoList.locator("text=" + title).waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    }

    public void assertNotVisible(String title) {
        try {
            todoList.locator("text=" + title).waitFor(new Locator.WaitForOptions()
                    .setState(WaitForSelectorState.HIDDEN).setTimeout(5000));
        } catch (TimeoutError ignored) {
            // mirrors the TS side's .catch(() => {}) — fall through to the count check below
        }
        int count = todoList.locator("[data-testid=\"todo-item\"]").filter(new Locator.FilterOptions().setHasText(title)).count();
        if (count > 0) {
            throw new AssertionError("Todo \"" + title + "\" is still visible but should not be");
        }
    }

    public int getTodoCount() {
        return todoList.locator("[data-testid=\"todo-item\"]").count();
    }

    private Locator getTodoItem(String title) {
        return todoList.locator("[data-testid=\"todo-item\"]").filter(new Locator.FilterOptions().setHasText(title));
    }

    public void editTodo(String currentTitle, String newTitle) {
        page.onceDialog(dialog -> dialog.accept(newTitle));
        page.waitForNavigation(new Page.WaitForNavigationOptions().setWaitUntil(WaitUntilState.NETWORKIDLE),
                () -> getTodoItem(currentTitle).locator("[data-testid=\"todo-edit\"]").click());
    }

    public void deleteTodo(String title) {
        page.onceDialog(com.microsoft.playwright.Dialog::accept);
        page.waitForNavigation(new Page.WaitForNavigationOptions().setWaitUntil(WaitUntilState.NETWORKIDLE),
                () -> getTodoItem(title).locator("[data-testid=\"todo-delete\"]").click());
    }

    public void toggleTodo(String title) {
        page.waitForNavigation(new Page.WaitForNavigationOptions().setWaitUntil(WaitUntilState.NETWORKIDLE),
                () -> getTodoItem(title).locator("[data-testid=\"todo-toggle\"]").click());
    }

    public void assertStatus(String title, String status) {
        Locator item = getTodoItem(title);
        item.locator(".todo-status").waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
        String text = item.locator(".todo-status").textContent();
        if (text == null || !text.contains(status)) {
            throw new AssertionError("Expected todo \"" + title + "\" to have status \"" + status + "\" but got \"" + text + "\"");
        }
    }

    public void assertPriority(String title, String priority) {
        Locator item = getTodoItem(title);
        String text = item.locator("[data-testid=\"todo-priority\"]").textContent();
        if (text == null || !text.trim().equals(priority)) {
            throw new AssertionError("Expected todo \"" + title + "\" to have priority \"" + priority + "\" but got \"" + text + "\"");
        }
    }
}
