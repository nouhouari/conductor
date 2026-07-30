package com.nouhouari.conductor.config;

import java.util.List;
import java.util.Map;

/** Mirrors src/config/types.ts FlutterDesktopConfig. */
public record FlutterDesktopConfig(
        String appPath,
        Integer defaultTimeoutMs,
        Integer launchTimeoutMs,
        Integer vmServicePort,
        List<String> extraArgs,
        Map<String, String> env,
        String screenshotDir) {
}
