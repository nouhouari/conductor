package com.nouhouari.conductor.hooks;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

import java.nio.file.Files;
import java.nio.file.Path;

/** Java port of src/hooks/flutterDesktop.hooks.ts. */
public class FlutterDesktopHooks {

    private final ConductorWorld world;

    public FlutterDesktopHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before("@flutter-desktop or @cross-platform")
    public void logFlutterDesktopAvailable() {
        // Intentionally does not eagerly launch — many @cross-platform scenarios
        // won't touch Flutter desktop at all; step defs call launch() when needed.
        if (world.config.flutterDesktop() != null) {
            world.logger.info("FlutterDesktopDriver available: {}", world.config.flutterDesktop().appPath());
        }
    }

    @After("@flutter-desktop or @cross-platform")
    public void teardownFlutterDesktop(Scenario scenario) {
        if (scenario.isFailed() && world.isFlutterDesktopLaunched()) {
            try {
                String name = scenario.getName().replaceAll("\\s+", "-").toLowerCase();
                String screenshotPath = world.flutterDesktop().takeScreenshot("failure-" + name + "-" + System.currentTimeMillis());
                byte[] buf = Files.readAllBytes(Path.of(screenshotPath));
                scenario.attach(buf, "image/png", name);
            } catch (Exception e) {
                world.logger.warn("Failed to capture FlutterDesktop screenshot: {}", e.getMessage());
            }
        }
        world.closeFlutterDesktop();
    }
}
