package com.nouhouari.conductor.config;

public record MobileConfig(
        String deviceId,
        String flowsDir,
        int timeoutMs,
        String maestroBin) {
}
