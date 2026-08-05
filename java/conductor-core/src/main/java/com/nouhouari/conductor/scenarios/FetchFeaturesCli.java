package com.nouhouari.conductor.scenarios;

import com.nouhouari.conductor.config.ConfigLoader;
import com.nouhouari.conductor.config.RemoteScenariosConfig;

/**
 * Prefetch step for the {@code remote} scenario source: fetch scenarios from the
 * requ scenario API and reconstruct them into {@code .feature} files, then exit.
 * Run before pointing a Cucumber {@code @Suite} at the output directory.
 *
 * <p>Java port of {@code src/scenarios/cli.ts}. Invoke with:
 * <pre>{@code
 * mvn -pl conductor-core exec:java \
 *   -Dexec.mainClass=com.nouhouari.conductor.scenarios.FetchFeaturesCli
 * }</pre>
 */
public final class FetchFeaturesCli {

    private FetchFeaturesCli() {
    }

    public static void main(String[] args) {
        try {
            run();
        } catch (RuntimeException e) {
            System.err.println("fetch-features failed: " + e.getMessage());
            System.exit(1);
        }
    }

    static void run() {
        RemoteScenariosConfig remote = ConfigLoader.get().remoteScenarios();
        if (remote == null) {
            throw new IllegalStateException(
                    "No `remoteScenarios` config found. Configure it in config/*.yml or via REMOTE_SCENARIOS_* env vars.");
        }

        String where = remote.project() != null && !remote.project().isBlank()
                ? " (project: " + remote.project() + ")"
                : "";
        System.out.println("Fetching scenarios from " + remote.baseUrl() + where + " ...");

        var scenarios = RemoteScenarioFetcher.fetchScenarios(remote);
        var result = RemoteScenarioFetcher.reconstructFeatureFiles(scenarios, remote.outputDir());

        System.out.println("Wrote " + result.scenarios() + " scenario(s) across "
                + result.features() + " feature file(s) to " + result.dir());
    }
}
