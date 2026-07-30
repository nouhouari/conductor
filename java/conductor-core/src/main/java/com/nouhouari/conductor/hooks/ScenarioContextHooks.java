package com.nouhouari.conductor.hooks;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

/**
 * Captures the current {@link Scenario} onto {@link ConductorWorld} so plain
 * step-definition methods can call {@code world.scenario.attach(...)} —
 * Cucumber-JVM only injects Scenario into @Before/@After hooks, not into
 * @Given/@When/@Then methods. Runs first (order = 0) so it's set before any
 * other @Before hook or step needs it.
 */
public class ScenarioContextHooks {

    private final ConductorWorld world;

    public ScenarioContextHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before(order = 0)
    public void captureScenario(Scenario scenario) {
        world.scenario = scenario;
    }
}
