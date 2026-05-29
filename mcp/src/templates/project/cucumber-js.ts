/**
 * Generates cucumber.js content for a bootstrapped Conductor test project.
 *
 * The canonical pattern: load framework hooks via require.resolve so they share
 * the same @cucumber/cucumber instance as the runner (required for World hooks).
 * Derived from docs/USER_GUIDE.md §2 and example/cucumber.js.
 */

export function renderCucumberJs(platforms: readonly string[]): string {
  const profiles: string[] = [];

  if (platforms.includes('web') || platforms.includes('cross-platform')) {
    profiles.push(`  web: {
    ...common,
    paths: ['features/web/**/*.feature'],
    tags: '@web',
  },`);
  }

  if (platforms.includes('api') || platforms.includes('cross-platform')) {
    profiles.push(`  api: {
    ...common,
    paths: ['features/api/**/*.feature'],
    tags: '@api',
  },`);
  }

  if (platforms.includes('mobile') || platforms.includes('cross-platform')) {
    profiles.push(`  mobile: {
    ...common,
    paths: ['features/mobile/**/*.feature'],
    tags: '@mobile',
  },`);
  }

  if (platforms.includes('desktop') || platforms.includes('cross-platform')) {
    profiles.push(`  desktop: {
    ...common,
    paths: ['features/desktop/**/*.feature'],
    tags: '@desktop',
  },`);
  }

  if (platforms.includes('cross-platform')) {
    profiles.push(`  'cross-platform': {
    ...common,
    paths: ['features/cross-platform/**/*.feature'],
    tags: '@cross-platform',
  },`);
  }

  const profileBlock =
    profiles.length > 0 ? `\n${profiles.join('\n')}\n` : '';

  return `const path = require('path');

// Resolve the conductor-e2e hooks file. We resolve the package main entry
// and derive the hooks path from it so that the hooks share the same
// @cucumber/cucumber instance as the runner — required for World hooks.
// This avoids relying on package subpath exports which may not be declared.
const conductorMain = require.resolve('conductor-e2e');
const conductorHooks = conductorMain.replace(/[\\/]dist[\\/]src[\\/]index\.js$/, path.sep + path.join('dist', 'src', 'hooks', 'index.js'));

const common = {
  requireModule: ['ts-node/register', 'tsconfig-paths/register'],
  // Load order matters: framework hooks first, then support/ (custom hooks,
  // setDefaultTimeout, etc. that register against Cucumber), then step defs.
  require: [conductorHooks, 'support/**/*.ts', 'step-definitions/**/*.ts'],
  // 'summary' is essential for diagnosing failures — without it, a failing run
  // prints minimal output and exits non-zero with no clue what broke.
  // 'progress-bar' adds the visual progress indicator for slow runs.
  format: [
    'summary',
    'progress-bar',
    'allure-cucumberjs/reporter',
    'json:reports/cucumber-report.json',
  ],
  formatOptions: { snippetInterface: 'async-await' },
};

module.exports = {
  default: {
    ...common,
    paths: ['features/**/*.feature'],
  },
${profileBlock}};
`;
}
