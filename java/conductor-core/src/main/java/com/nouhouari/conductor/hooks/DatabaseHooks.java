package com.nouhouari.conductor.hooks;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.After;
import io.cucumber.java.Before;

/** Java port of src/hooks/database.hooks.ts. */
public class DatabaseHooks {

    private final ConductorWorld world;

    public DatabaseHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before("@database or @cross-platform")
    public void connectDb() {
        if (world.hasDb()) {
            world.db().connect();
        }
    }

    @After("@database or @cross-platform")
    public void disconnectDb() {
        world.disconnectDb();
    }
}
