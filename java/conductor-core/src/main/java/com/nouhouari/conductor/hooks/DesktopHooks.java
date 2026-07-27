package com.nouhouari.conductor.hooks;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

/** Java port of src/hooks/desktop.hooks.ts (JavaFX). */
public class DesktopHooks {

    private final ConductorWorld world;

    public DesktopHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before("@desktop or @cross-platform")
    public void logDesktopAvailable() {
        world.logger.info("Desktop driver initialized for @desktop scenario");
    }

    @After("@desktop or @cross-platform")
    public void teardownDesktop(Scenario scenario) {
        if (scenario.isFailed() && world.isFxLaunched()) {
            String name = scenario.getName().replaceAll("\\s+", "-").toLowerCase();
            byte[] png = world.fx().screenshot("failure-" + name + "-" + System.currentTimeMillis());
            scenario.attach(png, "image/png", name);
        }
        world.closeFx();
    }
}
