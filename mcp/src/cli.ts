#!/usr/bin/env node
/**
 * conductor-mcp CLI entry point.
 *
 * Boots the MCP server and connects it to a stdio transport.
 * All log output goes to stderr — stdout is the JSON-RPC protocol channel.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const cwd = process.cwd();

  process.stderr.write(`[conductor-mcp] Starting server (cwd: ${cwd})\n`);

  const server = createServer(cwd);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  process.stderr.write(`[conductor-mcp] Server connected — waiting for requests\n`);

  // Keep the process alive until the transport closes
  process.on('SIGINT', () => {
    process.stderr.write(`[conductor-mcp] Received SIGINT — shutting down\n`);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.stderr.write(`[conductor-mcp] Received SIGTERM — shutting down\n`);
    process.exit(0);
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`[conductor-mcp] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
