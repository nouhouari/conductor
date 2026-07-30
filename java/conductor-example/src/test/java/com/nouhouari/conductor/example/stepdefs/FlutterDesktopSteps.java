package com.nouhouari.conductor.example.stepdefs;

import com.nouhouari.conductor.drivers.FlutterDesktopDriver;
import com.nouhouari.conductor.drivers.FlutterDesktopDriver.Finder;
import com.nouhouari.conductor.drivers.FlutterDesktopDriver.FinderType;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Files;
import java.nio.file.Path;

/** Java port of example/step-definitions/flutter-desktop.steps.ts. */
public class FlutterDesktopSteps {

    private final ConductorWorld world;

    public FlutterDesktopSteps(ConductorWorld world) {
        this.world = world;
    }

    private static Finder byText(String text) {
        return new Finder(FinderType.ByText, text);
    }

    private static Finder byKey(String key) {
        return new Finder(FinderType.ByValueKey, key);
    }

    @Given("the Flutter app is connected at {string}")
    public void theFlutterAppIsConnectedAt(String vmServiceUrl) {
        // Use when the app is already running (mobile via adb/iproxy port-forward,
        // or Windows/Linux desktop managed externally). Accepts an HTTP or WS URL.
        world.flutterDesktop().connect(vmServiceUrl);
    }

    @Given("the Flutter desktop app is running")
    public void theFlutterDesktopAppIsRunning() {
        world.flutterDesktop().launch();
        world.flutterDesktop().waitFor(byText("My Todos"), 15000);
        // Drain the initial _loadTodos() so later steps don't race with it.
        world.flutterDesktop().requestData("{\"action\":\"waitUntilLoaded\"}", 15000);
    }

    @When("I add a todo {string} via the Flutter desktop app")
    public void iAddATodoViaTheFlutterDesktopApp(String title) {
        world.flutterDesktop().tap(byKey("add-todo-fab"));
        world.flutterDesktop().waitFor(byKey("dialog-title-input"));
        // Inject text directly into the controller — avoids the TestTextInput mock
        // path where _client stays null on macOS because autofocus establishes the
        // connection before set_text_entry_emulation registers the mock.
        String setResp = world.flutterDesktop().requestData(
                "{\"action\":\"setDialogText\",\"text\":\"" + escape(title) + "\"}", 10000);
        if (setResp.startsWith("error:")) {
            throw new RuntimeException("setDialogText failed: " + setResp);
        }
        world.flutterDesktop().tap(byText("Save"));
        world.flutterDesktop().waitFor(byText(title));
        world.data.put("lastTodoTitle", title);
    }

    @When("I refresh the Flutter desktop app")
    public void iRefreshTheFlutterDesktopApp() {
        // Use requestData so the step waits for _loadTodos() to complete, rather
        // than relying on a tap gesture that may not fire onPressed on macOS desktop.
        String resp = world.flutterDesktop().requestData("{\"action\":\"refresh\"}", 15000);
        if (resp.startsWith("error:")) {
            throw new RuntimeException("refresh failed: " + resp);
        }
    }

    // Toggle, edit, delete use requestData to invoke app-side handlers directly,
    // bypassing flutter_driver's hitTestable() which never resolves for widgets
    // inside a ListView (Scrollable blocks hit tests with HitTestBehavior.opaque).

    @When("I toggle the todo {string} via the Flutter desktop app")
    public void iToggleTheTodoViaTheFlutterDesktopApp(String title) throws InterruptedException {
        String resp = world.flutterDesktop().requestData(
                "{\"action\":\"toggleTodo\",\"title\":\"" + escape(title) + "\"}", 15000);
        if (resp.startsWith("error:")) {
            throw new RuntimeException("toggleTodo failed: " + resp);
        }
        Thread.sleep(300);
    }

    @When("I edit the todo {string} to {string} via the Flutter desktop app")
    public void iEditTheTodoToViaTheFlutterDesktopApp(String currentTitle, String newTitle) {
        String resp = world.flutterDesktop().requestData(
                "{\"action\":\"editTodoTitle\",\"currentTitle\":\"" + escape(currentTitle)
                        + "\",\"newTitle\":\"" + escape(newTitle) + "\"}", 15000);
        if (resp.startsWith("error:")) {
            throw new RuntimeException("editTodoTitle failed: " + resp);
        }
        world.flutterDesktop().waitFor(byText(newTitle));
        world.data.put("lastTodoTitle", newTitle);
    }

    @When("I delete the todo {string} via the Flutter desktop app")
    public void iDeleteTheTodoViaTheFlutterDesktopApp(String title) {
        String resp = world.flutterDesktop().requestData(
                "{\"action\":\"deleteTodo\",\"title\":\"" + escape(title) + "\"}", 15000);
        if (resp.startsWith("error:")) {
            throw new RuntimeException("deleteTodo failed: " + resp);
        }
        world.flutterDesktop().waitForAbsent(byText(title));
    }

    @Then("the Flutter desktop app shows {string}")
    public void theFlutterDesktopAppShows(String text) {
        world.flutterDesktop().waitFor(byText(text));
    }

    @Then("the Flutter desktop app does not show {string}")
    public void theFlutterDesktopAppDoesNotShow(String text) {
        world.flutterDesktop().waitForAbsent(byText(text));
    }

    @Then("I take a Flutter desktop screenshot {string}")
    public void iTakeAFlutterDesktopScreenshot(String name) {
        String slug = name.replaceAll("\\s+", "-").toLowerCase();
        try {
            String screenshotPath = world.flutterDesktop().takeScreenshot(slug);
            byte[] buf = Files.readAllBytes(Path.of(screenshotPath));
            world.scenario.attach(buf, "image/png", slug);
        } catch (Exception e) {
            world.logger.warn("Flutter desktop screenshot failed: {}", e.getMessage());
        }
    }

    @When("I double-tap {string} key via Flutter desktop")
    public void iDoubleTapKeyViaFlutterDesktop(String key) {
        world.flutterDesktop().doubleTap(byKey(key));
    }

    @When("I long-press {string} key via Flutter desktop")
    public void iLongPressKeyViaFlutterDesktop(String key) {
        world.flutterDesktop().longPress(byKey(key));
    }

    @When("I scroll {string} into view via Flutter desktop")
    public void iScrollIntoViewViaFlutterDesktop(String text) {
        world.flutterDesktop().scrollIntoView(byText(text));
    }

    @When("I clear the Flutter desktop text field {string}")
    public void iClearTheFlutterDesktopTextField(String key) {
        world.flutterDesktop().clearText(byKey(key));
    }

    @When("I wait for the Flutter desktop app to be idle")
    public void iWaitForTheFlutterDesktopAppToBeIdle() {
        world.flutterDesktop().waitForCondition(FlutterDesktopDriver.WaitCondition.NoPendingFrames);
    }

    @When("I wait for Flutter desktop condition {string}")
    public void iWaitForFlutterDesktopCondition(String condition) {
        world.flutterDesktop().waitForCondition(condition);
    }

    @Then("{string} is visible on the Flutter desktop app")
    public void isVisibleOnTheFlutterDesktopApp(String text) {
        if (!world.flutterDesktop().isVisible(byText(text))) {
            throw new AssertionError("Expected \"" + text + "\" to be visible but was not found");
        }
    }

    @Then("{string} is not visible on the Flutter desktop app")
    public void isNotVisibleOnTheFlutterDesktopApp(String text) {
        if (world.flutterDesktop().isVisible(byText(text), 500)) {
            throw new AssertionError("Expected \"" + text + "\" to be absent but was visible");
        }
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
