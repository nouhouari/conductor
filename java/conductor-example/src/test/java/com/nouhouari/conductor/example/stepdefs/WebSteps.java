package com.nouhouari.conductor.example.stepdefs;

import com.nouhouari.conductor.example.pages.LoginPage;
import com.nouhouari.conductor.example.pages.TodoPage;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** Java port of example/step-definitions/web.steps.ts. */
public class WebSteps {

    private final ConductorWorld world;

    public WebSteps(ConductorWorld world) {
        this.world = world;
    }

    @Given("I am on the todo web application")
    public void iAmOnTheTodoWebApplication() {
        world.page().navigate(world.config.web().baseUrl());
    }

    @When("I log in as {string} with password {string}")
    public void iLogInAsWithPassword(String username, String password) {
        new LoginPage(world.page(), world.config).login(username, password);
    }

    @When("I create a todo titled {string}")
    public void iCreateATodoTitled(String title) {
        new TodoPage(world.page(), world.config).createTodo(title);
        world.data.put("lastTodoTitle", title);
    }

    @When("I create a todo titled {string} with priority {string}")
    public void iCreateATodoTitledWithPriority(String title, String priority) {
        new TodoPage(world.page(), world.config).createTodo(title, priority);
        world.data.put("lastTodoTitle", title);
    }

    @When("I edit the todo {string} to {string}")
    public void iEditTheTodoTo(String currentTitle, String newTitle) {
        new TodoPage(world.page(), world.config).editTodo(currentTitle, newTitle);
        world.data.put("lastTodoTitle", newTitle);
    }

    @When("I delete the todo {string}")
    public void iDeleteTheTodo(String title) {
        new TodoPage(world.page(), world.config).deleteTodo(title);
    }

    @When("I toggle the todo {string}")
    public void iToggleTheTodo(String title) {
        new TodoPage(world.page(), world.config).toggleTodo(title);
    }

    @Then("the todo {string} appears on the web dashboard")
    public void theTodoAppearsOnTheWebDashboard(String title) {
        new TodoPage(world.page(), world.config).assertVisible(title);
    }

    @Then("the todo {string} should not appear on the web dashboard")
    public void theTodoShouldNotAppearOnTheWebDashboard(String title) {
        new TodoPage(world.page(), world.config).assertNotVisible(title);
    }

    @Then("the todo {string} should have status {string} on the web")
    public void theTodoShouldHaveStatusOnTheWeb(String title, String status) {
        new TodoPage(world.page(), world.config).assertStatus(title, status);
    }

    @Then("the todo {string} should have priority {string} on the web")
    public void theTodoShouldHavePriorityOnTheWeb(String title, String priority) {
        new TodoPage(world.page(), world.config).assertPriority(title, priority);
    }

    @Then("the web dashboard should show {int} todo(s)")
    public void theWebDashboardShouldShowTodos(int count) {
        int actual = new TodoPage(world.page(), world.config).getTodoCount();
        if (actual != count) {
            throw new AssertionError("Expected " + count + " todos but found " + actual);
        }
    }
}
