package com.nouhouari.conductor.config;

import java.util.List;

/** JavaFX desktop agent config — mirrors src/config/types.ts DesktopConfig. */
public record DesktopConfig(
        String agentJar,
        String javaBin,
        Integer agentPort,
        String agentHost,
        Integer defaultTimeoutMs,
        Integer pollIntervalMs,
        String screenshotDir,
        List<String> jvmArgs) {
}
