package com.nouhouari.conductor.example.stepdefs;

import com.microsoft.playwright.APIResponse;
import com.nouhouari.conductor.example.model.TodoResponse;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.List;
import java.util.Map;

/** Java port of example/step-definitions/api.steps.ts. */
public class ApiSteps {

    private final ConductorWorld world;

    public ApiSteps(ConductorWorld world) {
        this.world = world;
    }

    private String todosUrl() {
        return world.config.api().baseUrl() + "/api/todos";
    }

    private void requireOk(APIResponse response, String action) {
        if (!response.ok()) {
            throw new RuntimeException("Failed to " + action + ": " + response.status() + " " + response.statusText());
        }
    }

    private TodoResponse findByTitle(String title) {
        List<TodoResponse> todos = world.api().jsonList(world.api().get(todosUrl()), TodoResponse.class);
        return todos.stream().filter(t -> t.title().equals(title)).findFirst()
                .orElseThrow(() -> new RuntimeException("Todo \"" + title + "\" not found"));
    }

    @Given("a todo {string} exists via the API")
    public void aTodoExistsViaTheApi(String title) {
        ApiHelpers.ensureApi(world);
        APIResponse response = world.api().post(todosUrl(), Map.of("title", title, "status", "open"));
        requireOk(response, "create todo");
        TodoResponse todo = world.api().json(response, TodoResponse.class);
        world.data.put("lastTodoId", todo.id());
        world.data.put("lastTodoTitle", title);
    }

    @Given("a todo {string} with priority {string} exists via the API")
    public void aTodoWithPriorityExistsViaTheApi(String title, String priority) {
        ApiHelpers.ensureApi(world);
        APIResponse response = world.api().post(todosUrl(), Map.of("title", title, "status", "open", "priority", priority));
        requireOk(response, "create todo");
        TodoResponse todo = world.api().json(response, TodoResponse.class);
        world.data.put("lastTodoId", todo.id());
        world.data.put("lastTodoTitle", title);
    }

    @When("I create a todo {string} via the API")
    public void iCreateATodoViaTheApi(String title) {
        ApiHelpers.ensureApi(world);
        APIResponse response = world.api().post(todosUrl(), Map.of("title", title, "status", "open"));
        requireOk(response, "create todo");
        TodoResponse todo = world.api().json(response, TodoResponse.class);
        world.data.put("lastTodoId", todo.id());
        world.data.put("lastTodoTitle", title);
    }

    @When("I create a todo {string} with priority {string} via the API")
    public void iCreateATodoWithPriorityViaTheApi(String title, String priority) {
        ApiHelpers.ensureApi(world);
        APIResponse response = world.api().post(todosUrl(), Map.of("title", title, "status", "open", "priority", priority));
        requireOk(response, "create todo");
        TodoResponse todo = world.api().json(response, TodoResponse.class);
        world.data.put("lastTodoId", todo.id());
        world.data.put("lastTodoTitle", title);
    }

    @When("I update the todo {string} title to {string} via the API")
    public void iUpdateTheTodoTitleToViaTheApi(String currentTitle, String newTitle) {
        ApiHelpers.ensureApi(world);
        TodoResponse todo = findByTitle(currentTitle);
        APIResponse response = world.api().put(todosUrl() + "/" + todo.id(), Map.of("title", newTitle));
        requireOk(response, "update todo");
        world.data.put("lastTodoId", todo.id());
        world.data.put("lastTodoTitle", newTitle);
    }

    @When("I update the todo {string} status to {string} via the API")
    public void iUpdateTheTodoStatusToViaTheApi(String title, String status) {
        ApiHelpers.ensureApi(world);
        TodoResponse todo = findByTitle(title);
        APIResponse response = world.api().put(todosUrl() + "/" + todo.id(), Map.of("status", status));
        requireOk(response, "update todo");
    }

    @When("I update the todo {string} priority to {string} via the API")
    public void iUpdateTheTodoPriorityToViaTheApi(String title, String priority) {
        ApiHelpers.ensureApi(world);
        TodoResponse todo = findByTitle(title);
        APIResponse response = world.api().put(todosUrl() + "/" + todo.id(), Map.of("priority", priority));
        requireOk(response, "update todo");
    }

    @When("I delete the todo {string} via the API")
    public void iDeleteTheTodoViaTheApi(String title) {
        ApiHelpers.ensureApi(world);
        TodoResponse todo = findByTitle(title);
        APIResponse response = world.api().delete(todosUrl() + "/" + todo.id());
        if (response.status() != 204) {
            throw new RuntimeException("Failed to delete todo: " + response.status() + " " + response.statusText());
        }
    }

    @Then("the API should return the todo {string} with status {string}")
    public void theApiShouldReturnTheTodoWithStatus(String title, String status) {
        ApiHelpers.ensureApi(world);
        TodoResponse found = findByTitle(title);
        if (!found.status().equals(status)) {
            throw new AssertionError("Expected status \"" + status + "\" but got \"" + found.status() + "\"");
        }
    }

    @Then("the API should return the todo {string} with priority {string}")
    public void theApiShouldReturnTheTodoWithPriority(String title, String priority) {
        ApiHelpers.ensureApi(world);
        TodoResponse found = findByTitle(title);
        if (!found.priority().equals(priority)) {
            throw new AssertionError("Expected priority \"" + priority + "\" but got \"" + found.priority() + "\"");
        }
    }

    @Then("the API should not return a todo {string}")
    public void theApiShouldNotReturnATodo(String title) {
        ApiHelpers.ensureApi(world);
        APIResponse response = world.api().get(todosUrl());
        requireOk(response, "list todos");
        List<TodoResponse> todos = world.api().jsonList(response, TodoResponse.class);
        boolean found = todos.stream().anyMatch(t -> t.title().equals(title));
        if (found) {
            throw new AssertionError("Todo \"" + title + "\" should not exist but was found");
        }
    }

    @Then("the API should return {int} todo(s)")
    public void theApiShouldReturnTodos(int count) {
        ApiHelpers.ensureApi(world);
        APIResponse response = world.api().get(todosUrl());
        requireOk(response, "list todos");
        List<TodoResponse> todos = world.api().jsonList(response, TodoResponse.class);
        if (todos.size() != count) {
            throw new AssertionError("Expected " + count + " todos but got " + todos.size());
        }
    }
}
