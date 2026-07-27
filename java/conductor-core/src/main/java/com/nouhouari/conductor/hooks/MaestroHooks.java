package com.nouhouari.conductor.hooks;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.Before;

/** Java port of src/hooks/maestro.hooks.ts. No @After — Maestro has no persistent process to tear down. */
public class MaestroHooks {

    private final ConductorWorld world;

    public MaestroHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before("@mobile or @cross-platform")
    public void logTargetDevice() {
        String deviceId = world.config.mobile().deviceId() != null ? world.config.mobile().deviceId() : "default";
        world.logger.info("Targeting Maestro device: {}", deviceId);
    }
}
