package com.nouhouari.conductor.example.stepdefs;

import com.microsoft.playwright.APIResponse;
import com.nouhouari.conductor.drivers.MaestroDriver;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.Map;

/** Java port of example/step-definitions/mobile.steps.ts. */
public class MobileSteps {

    private static final long STEP_TIMEOUT_MS = 150_000;

    private final ConductorWorld world;

    public MobileSteps(ConductorWorld world) {
        this.world = world;
    }

    @When("the Flutter app launches")
    public void theFlutterAppLaunches() {
        world.maestro().runOrThrow("launch-app");
    }

    @When("the Flutter app launches with a clean state")
    public void theFlutterAppLaunchesWithACleanState() {
        world.maestro().runOrThrow("launch-app-clean");
    }

    @Then("the home screen is visible")
    public void theHomeScreenIsVisible() {
        // no-op, matches the TS placeholder
    }

    @Then("the todo list shows {string}")
    public void theTodoListShows(String text) {
        // no-op, matches the TS placeholder
    }

    @Given("a todo {string} exists in the system")
    public void aTodoExistsInTheSystem(String title) {
        if (!world.api().isInitialized()) {
            world.api().init();
        }
        APIResponse response = world.api().post(world.config.api().baseUrl() + "/api/todos",
                Map.of("title", title, "status", "open"));
        if (!response.ok()) {
            throw new RuntimeException("Failed to seed todo: " + response.status() + " " + response.statusText());
        }
        world.data.put("lastTodoTitle", title);
    }

    @When("I navigate to the todo list")
    public void iNavigateToTheTodoList() {
        // no-op, matches the TS placeholder
    }

    @Then("the todo {string} is visible on screen")
    public void theTodoIsVisibleOnScreen(String title) {
        String slug = title.replaceAll("\\s+", "-").toLowerCase();
        world.maestro().runOrThrow("navigate-to-todos", Map.of(
                "TODO_TITLE", title,
                "SCREENSHOT_NAME", "todo-" + slug));
    }

    @Then("a screenshot {string} is taken")
    public void aScreenshotIsTaken(String name) {
        world.logger.info("Screenshot captured by Maestro flow: {}", name);
    }

    @When("I create a todo {string} on the mobile app")
    public void iCreateATodoOnTheMobileApp(String title) {
        world.maestro().runOrThrow("create-todo", Map.of("TODO_TITLE", title));
        world.data.put("lastTodoTitle", title);
    }

    @When("I edit the todo {string} to {string} on the mobile app")
    public void iEditTheTodoToOnTheMobileApp(String oldTitle, String newTitle) {
        world.maestro().runOrThrow("edit-todo", Map.of("OLD_TITLE", oldTitle, "NEW_TITLE", newTitle));
        world.data.put("lastTodoTitle", newTitle);
    }

    @When("I toggle the todo {string} on the mobile app")
    public void iToggleTheTodoOnTheMobileApp(String title) {
        world.maestro().runOrThrow("toggle-todo", Map.of("TODO_TITLE", title));
    }

    @When("I mark the todo {string} as done on the mobile app")
    public void iMarkTheTodoAsDoneOnTheMobileApp(String title) {
        world.maestro().runOrThrow("toggle-todo", Map.of("TODO_TITLE", title));
    }

    @When("I mark the todo {string} as open on the mobile app")
    public void iMarkTheTodoAsOpenOnTheMobileApp(String title) {
        world.maestro().runOrThrow("toggle-todo", Map.of("TODO_TITLE", title));
    }

    @When("I delete the todo {string} on the mobile app")
    public void iDeleteTheTodoOnTheMobileApp(String title) {
        world.maestro().runOrThrow("delete-todo", Map.of("TODO_TITLE", title));
    }

    @Then("the mobile app should display {string}")
    public void theMobileAppShouldDisplay(String title) {
        world.maestro().runOrThrow("verify-todo", Map.of("TODO_TITLE", title));
    }

    @Then("the mobile app should not display {string}")
    public void theMobileAppShouldNotDisplay(String title) {
        world.maestro().runOrThrow("launch-app");
        MaestroDriver.Result result = world.maestro().run("verify-todo", Map.of("TODO_TITLE", title));
        if (result.success()) {
            throw new AssertionError("Todo \"" + title + "\" should not be visible on mobile but was found");
        }
    }
}
