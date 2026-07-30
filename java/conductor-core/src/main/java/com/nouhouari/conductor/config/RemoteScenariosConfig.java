package com.nouhouari.conductor.config;

/** Lower priority (M6) — sources scenarios from a remote "requ scenario API". */
public record RemoteScenariosConfig(
        String baseUrl,
        String project,
        RemoteScenariosFilters filters,
        String outputDir) {
}
