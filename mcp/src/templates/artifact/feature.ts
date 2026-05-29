/**
 * Templates for generating Cucumber feature files.
 */

export interface ScenarioInput {
  readonly name: string;
  readonly steps: readonly string[];
}

const PLATFORM_TAG: Record<string, string> = {
  web: '@web',
  api: '@api',
  mobile: '@mobile',
  desktop: '@desktop',
  'cross-platform': '@cross-platform',
};

function formatStep(step: string): string {
  // Normalise to Given/When/Then/And/But prefixes or default to Given
  const trimmed = step.trim();
  if (/^(Given|When|Then|And|But)\s/i.test(trimmed)) {
    return `    ${trimmed}`;
  }
  return `    Given ${trimmed}`;
}

export function renderFeatureTemplate(
  platform: string,
  featureName: string,
  scenarios: readonly ScenarioInput[],
): string {
  const tag = PLATFORM_TAG[platform] ?? `@${platform}`;

  const scenarioBlocks = scenarios
    .map((scenario) => {
      const stepLines = scenario.steps.map(formatStep).join('\n');
      return `  Scenario: ${scenario.name}\n${stepLines}`;
    })
    .join('\n\n');

  return `${tag}
Feature: ${featureName}

${scenarioBlocks}
`;
}
