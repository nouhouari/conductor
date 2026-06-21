#!/usr/bin/env node
import { config } from '../../config';
import { fetchScenarios, reconstructFeatureFiles } from './RemoteScenarioFetcher';

/**
 * Prefetch step for the `remote` cucumber profile: fetch scenarios from the requ
 * scenario API and reconstruct them into `.feature` files, then exit. Run before
 * `cucumber-js --profile remote`.
 */
async function main(): Promise<void> {
  const remote = config.remoteScenarios;
  if (!remote) {
    throw new Error(
      'No `remoteScenarios` config found. Configure it in config/environments or via REMOTE_SCENARIOS_* env vars.',
    );
  }

  const where = remote.project ? ` (project: ${remote.project})` : '';
  console.log(`Fetching scenarios from ${remote.baseUrl}${where} ...`);

  const scenarios = await fetchScenarios(remote);
  const result = await reconstructFeatureFiles(scenarios, remote.outputDir);

  console.log(
    `Wrote ${result.scenarios} scenario(s) across ${result.features} feature file(s) to ${result.dir}`,
  );
}

main().catch((err: unknown) => {
  console.error(`fetch-features failed: ${(err as Error).message}`);
  process.exit(1);
});
