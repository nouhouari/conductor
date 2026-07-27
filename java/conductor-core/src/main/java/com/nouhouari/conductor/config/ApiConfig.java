package com.nouhouari.conductor.config;

public record ApiConfig(
        String baseUrl,
        Credentials defaultCredentials,
        Integer timeoutMs) {
}
