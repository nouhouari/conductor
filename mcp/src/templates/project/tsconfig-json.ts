/**
 * Generates tsconfig.json content for a bootstrapped Conductor test project.
 * Matches the template documented in docs/USER_GUIDE.md §2.
 */

export function renderTsConfigJson(): string {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      // 'DOM' is required for Storage / localStorage / Window types that web
      // step definitions commonly reach for via Playwright's page.evaluate.
      lib: ['ES2022', 'DOM'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      forceConsistentCasingInFileNames: true,
      baseUrl: '.',
    },
    include: ['./**/*.ts'],
    exclude: ['node_modules', 'dist'],
  };

  return JSON.stringify(tsconfig, null, 2) + '\n';
}
