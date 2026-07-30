package com.nouhouari.conductor.example.stepdefs;

import com.nouhouari.conductor.drivers.MaestroDriver;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Then;

import java.util.Map;

/**
 * Java port of example/step-definitions/cross-platform.steps.ts. The rest of
 * the @cross-platform feature reuses steps already registered by WebSteps
 * and ApiSteps — Cucumber-JVM's glue package scanning merges all step-def
 * classes on the glue path, same as cucumber.js's require array.
 */
public class CrossPlatformSteps {

    private final ConductorWorld world;

    public CrossPlatformSteps(ConductorWorld world) {
        this.world = world;
    }

    @Then("the Flutter app should display {string} in the todo list")
    public void theFlutterAppShouldDisplayInTheTodoList(String title) {
        MaestroDriver.Result result = world.maestro().runOrThrow("verify-todo", Map.of("TODO_TITLE", title));
        world.logger.info("Maestro run complete: {}", result.output());
    }
}
