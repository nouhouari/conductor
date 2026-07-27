package com.nouhouari.conductor.config;

/**
 * Mirrors src/config/types.ts WebConfig. browserName is one of
 * "chromium" | "firefox" | "webkit" (validated at WebDriver.launch() time,
 * matching the TS side, which also casts without runtime validation).
 */
public record WebConfig(
        String baseUrl,
        boolean headless,
        String browserName,
        Integer slowMo,
        Viewport viewport) {
}
