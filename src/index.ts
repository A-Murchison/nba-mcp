#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { buildServerCapabilities, createNbaMcpServer } from "./mcpServer.js";
import { createProvider } from "./providers/index.js";

export { buildServerCapabilities, createNbaMcpServer } from "./mcpServer.js";

export async function getServerCapabilities() {
  const config = loadConfig();
  const provider = createProvider(config);
  return buildServerCapabilities(provider);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createNbaMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`nba-mcp ${config.provider} provider running on stdio\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to start nba-mcp server: ${message}\n`);
    process.exitCode = 1;
  });
}
