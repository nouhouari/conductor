package com.nouhouari.conductor.config;

/**
 * Java port of config/types.ts EnvironmentConfig. desktop, flutterDesktop and
 * remoteScenarios are nullable, matching the TS optional fields — accessing
 * a driver that needs one of these (JavaFxDriver, FlutterDesktopDriver) throws
 * if the corresponding config block is absent, mirroring ConductorWorld.ts.
 */
public record EnvironmentConfig(
        String name,
        WebConfig web,
        ApiConfig api,
        MobileConfig mobile,
        DatabaseConfig database,
        DesktopConfig desktop,
        FlutterDesktopConfig flutterDesktop,
        RemoteScenariosConfig remoteScenarios) {
}
