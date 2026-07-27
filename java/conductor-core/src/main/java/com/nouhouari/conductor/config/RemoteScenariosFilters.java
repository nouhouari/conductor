package com.nouhouari.conductor.config;

public record RemoteScenariosFilters(
        String story,
        String requirement,
        String phase,
        String mode,
        String tags,
        String feature,
        String q,
        Boolean valid) {
}
