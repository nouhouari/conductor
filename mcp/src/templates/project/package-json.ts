/**
 * Generates package.json content for a bootstrapped Conductor test project.
 * Derived from docs/USER_GUIDE.md §2 and example/package.json.
 */

export interface PackageJsonOptions {
  readonly name: string;
  readonly platforms: readonly string[];
}

export function renderPackageJson(options: PackageJsonOptions): string {
  const { name, platforms } = options;

  const scripts: Record<string, string> = {
    test: 'cucumber-js',
    'test:dry-run': 'cucumber-js --dry-run',
    report: 'allure generate allure-results --clean -o allure-report',
    'report:open': 'allure open allure-report',
  };

  if (platforms.includes('web') || platforms.includes('cross-platform')) {
    scripts['test:web'] = 'cucumber-js --profile web';
  }
  if (platforms.includes('api') || platforms.includes('cross-platform')) {
    scripts['test:api'] = 'cucumber-js --profile api';
  }
  if (platforms.includes('mobile') || platforms.includes('cross-platform')) {
    scripts['test:mobile'] = 'cucumber-js --profile mobile';
  }
  if (platforms.includes('desktop') || platforms.includes('cross-platform')) {
    scripts['test:desktop'] = 'cucumber-js --profile desktop';
  }
  if (platforms.includes('cross-platform')) {
    scripts['test:cross'] = 'cucumber-js --profile cross-platform';
  }

  const pkg = {
    name,
    version: '0.1.0',
    private: true,
    scripts,
    dependencies: {
      '@cucumber/cucumber': '^11.0.0',
      'allure-cucumberjs': '^3.0.0',
      'conductor-e2e': '^0.1.1',
      'ts-node': '^10.9.0',
      'tsconfig-paths': '^4.2.0',
      typescript: '^5.4.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'allure-commandline': '^2.27.0',
    },
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}
