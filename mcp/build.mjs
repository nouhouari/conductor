/**
 * Build script for conductor-mcp using esbuild.
 *
 * esbuild transpiles TypeScript ~100x faster than tsc by skipping type-checking.
 * Run `npm run typecheck` for full TypeScript validation.
 *
 * The output is CommonJS (for Node.js compat), unbundled from external deps,
 * preserving require() calls for @modelcontextprotocol/sdk, zod, js-yaml.
 */

import { build } from 'esbuild';
import { chmodSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cli.js',
  // Keep these as external require() calls — they're in node_modules
  external: [
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/*',
    'zod',
    'js-yaml',
    'typescript',
  ],
  sourcemap: true,
  logLevel: 'info',
});

// Remove the auto-generated shebang duplicate (esbuild doesn't add shebang from banner
// when bundling, so we patch the output to ensure the shebang is at the top).
import { readFileSync, writeFileSync } from 'fs';
const output = readFileSync('dist/cli.js', 'utf8');
if (!output.startsWith('#!/usr/bin/env node')) {
  writeFileSync('dist/cli.js', '#!/usr/bin/env node\n' + output);
}

chmodSync('dist/cli.js', 0o755);
console.log('conductor-mcp build complete → dist/cli.js');
