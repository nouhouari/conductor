package com.nouhouari.conductor.example.stepdefs;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Then;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Java port of example/step-definitions/screenshot.steps.ts — cross-cutting screenshot steps. */
public class ScreenshotSteps {

    private final ConductorWorld world;

    public ScreenshotSteps(ConductorWorld world) {
        this.world = world;
    }

    @Then("I take a screenshot {string}")
    public void iTakeAScreenshot(String name) {
        String slug = name.replaceAll("\\s+", "-").toLowerCase();
        ensureScreenshotsDir();

        if (world.web().isLaunched()) {
            byte[] screenshot = world.web().takeScreenshot(slug);
            world.scenario.attach(screenshot, "image/png", slug);
            world.logger.info("Web screenshot captured: reports/screenshots/{}.png", slug);
        }

        if (world.config.mobile().deviceId() != null) {
            try {
                byte[] buffer = world.maestro().takeScreenshot(slug);
                world.scenario.attach(buffer, "image/png", slug);
                world.logger.info("Mobile screenshot captured: {}", slug);
            } catch (RuntimeException e) {
                world.logger.warn("Mobile screenshot skipped — no device or Maestro unavailable");
            }
        }
    }

    @Then("I take a web screenshot {string}")
    public void iTakeAWebScreenshot(String name) {
        String slug = name.replaceAll("\\s+", "-").toLowerCase();
        ensureScreenshotsDir();
        byte[] screenshot = world.web().takeScreenshot(slug);
        world.scenario.attach(screenshot, "image/png", slug);
    }

    @Then("I take a mobile screenshot {string}")
    public void iTakeAMobileScreenshot(String name) {
        String slug = name.replaceAll("\\s+", "-").toLowerCase();
        ensureScreenshotsDir();
        byte[] buffer = world.maestro().takeScreenshot(slug);
        world.scenario.attach(buffer, "image/png", slug);
    }

    private static void ensureScreenshotsDir() {
        try {
            Files.createDirectories(Path.of("reports/screenshots"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
