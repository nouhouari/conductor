package com.nouhouari.conductor.example.stepdefs;

import com.microsoft.playwright.APIResponse;
import com.nouhouari.conductor.example.model.TodoResponse;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.Before;

import java.util.List;

/**
 * Java port of example/step-definitions/cleanup.hooks.ts — an untagged
 * global @Before that clears todos via the API before every scenario.
 * This is example-specific (not framework-core), so it lives here rather
 * than in conductor-core's hooks package.
 */
public class CleanupHooks {

    private final ConductorWorld world;

    public CleanupHooks(ConductorWorld world) {
        this.world = world;
    }

    @Before
    public void clearTodos() {
        if (!world.api().isInitialized()) {
            world.api().init();
        }
        APIResponse response = world.api().get(world.config.api().baseUrl() + "/api/todos");
        if (response.ok()) {
            List<TodoResponse> todos = world.api().jsonList(response, TodoResponse.class);
            for (TodoResponse todo : todos) {
                world.api().delete(world.config.api().baseUrl() + "/api/todos/" + todo.id());
            }
        }
    }
}
