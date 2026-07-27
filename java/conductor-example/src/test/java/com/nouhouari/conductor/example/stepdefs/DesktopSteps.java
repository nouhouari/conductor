package com.nouhouari.conductor.example.stepdefs;

import com.nouhouari.conductor.drivers.JavaFxDriver;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Paths;
import java.util.List;

/** Java port of example/step-definitions/desktop.steps.ts (JavaFX, via JavaFxDriver / fxagent.jar). */
public class DesktopSteps {

    private final ConductorWorld world;

    public DesktopSteps(ConductorWorld world) {
        this.world = world;
    }

    @Given("the desktop app is running")
    public void theDesktopAppIsRunning() {
        String jarPath = Paths.get("../apps/desktop/build/libs/todoapp-desktop-all.jar").toAbsolutePath().toString();
        String apiUrl = System.getenv("API_BASE_URL_FOR_DESKTOP") != null
                ? System.getenv("API_BASE_URL_FOR_DESKTOP")
                : world.config.api().baseUrl();
        world.logger.info("Launching desktop app: jarPath={} apiUrl={} agentJar={}",
                jarPath, apiUrl, world.config.desktop() != null ? world.config.desktop().agentJar() : null);
        try {
            world.fx().launch(new JavaFxDriver.LaunchOptions(
                    "com.example.todoapp.Launcher",
                    jarPath,
                    List.of("-DAPI_BASE_URL=" + apiUrl),
                    30000));
        } catch (RuntimeException e) {
            world.logger.error("Desktop launch failed: {}", e.getMessage());
            throw e;
        }
        world.fx().locator("#todo-input").waitFor(new JavaFxDriver.WaitOptions("visible", 15000));
    }

    @When("I create a todo {string} with priority {string} via the desktop app")
    public void iCreateATodoWithPriorityViaTheDesktopApp(String title, String priority) {
        world.fx().locator("#todo-input").fill(title);
        world.fx().locator("#todo-priority-select").selectOption(priority);
        world.fx().locator("#todo-add").click();
        world.fx().locator("text=" + title).waitFor(new JavaFxDriver.WaitOptions("visible", null));
        world.data.put("lastTodoTitle", title);
    }

    @When("I create a todo {string} via the desktop app")
    public void iCreateATodoViaTheDesktopApp(String title) {
        world.fx().locator("#todo-input").fill(title);
        world.fx().locator("#todo-add").click();
        world.fx().locator("text=" + title).waitFor(new JavaFxDriver.WaitOptions("visible", null));
        world.data.put("lastTodoTitle", title);
    }

    private void refreshDesktop() {
        world.fx().locator("#refresh-btn").click();
    }

    @When("I edit the todo {string} to {string} via the desktop app")
    public void iEditTheTodoToViaTheDesktopApp(String currentTitle, String newTitle) throws InterruptedException {
        int id = ApiHelpers.findTodoIdByTitle(world, currentTitle);
        refreshDesktop();
        world.fx().locator("#edit-" + id).waitFor(new JavaFxDriver.WaitOptions("visible", 10000));
        world.fx().locator("#edit-" + id).click();
        world.fx().locator("text=OK").waitFor(new JavaFxDriver.WaitOptions("visible", 5000));
        // Dialog's text field uses .text-input style class — query all and pick the focused one (dialog field)
        world.fx().locator("css=.dialog-pane .text-input").setText(newTitle);
        world.fx().locator("text=OK").click();
        world.fx().locator("text=" + newTitle).waitFor(new JavaFxDriver.WaitOptions("visible", null));
        Thread.sleep(500);
    }

    @When("I toggle the todo {string} via the desktop app")
    public void iToggleTheTodoViaTheDesktopApp(String title) throws InterruptedException {
        int id = ApiHelpers.findTodoIdByTitle(world, title);
        refreshDesktop();
        world.fx().locator("#toggle-" + id).waitFor(new JavaFxDriver.WaitOptions("visible", 10000));
        world.fx().locator("#toggle-" + id).click();
        // Wait for the async PUT to complete server-side
        Thread.sleep(800);
    }

    @When("I delete the todo {string} via the desktop app")
    public void iDeleteTheTodoViaTheDesktopApp(String title) {
        int id = ApiHelpers.findTodoIdByTitle(world, title);
        refreshDesktop();
        world.fx().locator("#delete-" + id).waitFor(new JavaFxDriver.WaitOptions("visible", 10000));
        world.fx().locator("#delete-" + id).click();
        world.fx().locator("text=OK").waitFor(new JavaFxDriver.WaitOptions("visible", 5000));
        world.fx().locator("text=OK").click();
    }

    @Then("the todo {string} should be visible on the desktop app")
    public void theTodoShouldBeVisibleOnTheDesktopApp(String title) {
        world.fx().locator("text=" + title).waitFor(new JavaFxDriver.WaitOptions("visible", null));
    }

    @Then("the todo {string} should not be visible on the desktop app")
    public void theTodoShouldNotBeVisibleOnTheDesktopApp(String title) {
        world.fx().locator("text=" + title).waitFor(new JavaFxDriver.WaitOptions("hidden", 5000));
    }

    @Then("I take a desktop screenshot {string}")
    public void iTakeADesktopScreenshot(String name) {
        String slug = name.replaceAll("\\s+", "-").toLowerCase();
        try {
            byte[] buffer = world.fx().screenshot(slug);
            world.scenario.attach(buffer, "image/png", slug);
        } catch (RuntimeException e) {
            world.logger.warn("Desktop screenshot failed: {}", e.getMessage());
        }
    }
}
