package com.nouhouari.conductor.hooks;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

/** Java port of src/hooks/browser.hooks.ts. */
public class BrowserHooks {

    private final ConductorWorld world;

    public BrowserHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before("@web or @cross-platform")
    public void launchWeb() {
        world.web().launch();
    }

    @After("@web or @cross-platform")
    public void teardownWeb(Scenario scenario) {
        if (scenario.isFailed() && world.web().isLaunched()) {
            String name = scenario.getName().replaceAll("\\s+", "-").toLowerCase();
            byte[] png = world.web().takeScreenshot("failure-" + name + "-" + System.currentTimeMillis());
            scenario.attach(png, "image/png", name);
        }
        world.closeWeb();
    }
}
