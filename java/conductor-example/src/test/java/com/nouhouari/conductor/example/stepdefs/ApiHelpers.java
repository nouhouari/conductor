package com.nouhouari.conductor.example.stepdefs;

import com.microsoft.playwright.APIResponse;
import com.nouhouari.conductor.example.model.TodoResponse;
import com.nouhouari.conductor.world.ConductorWorld;

import java.util.List;

/** Java port of the module-level helper functions scattered across api.steps.ts / desktop.steps.ts. */
final class ApiHelpers {

    private ApiHelpers() {
    }

    static void ensureApi(ConductorWorld world) {
        if (!world.api().isInitialized()) {
            if (world.web().isLaunched()) {
                world.api().init(world.web().getContext());
            } else {
                world.api().init();
            }
        }
    }

    static int findTodoIdByTitle(ConductorWorld world, String title) {
        ensureApi(world);
        APIResponse response = world.api().get(world.config.api().baseUrl() + "/api/todos");
        List<TodoResponse> todos = world.api().jsonList(response, TodoResponse.class);
        return todos.stream()
                .filter(t -> t.title().equals(title))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Todo \"" + title + "\" not found via API"))
                .id();
    }
}
