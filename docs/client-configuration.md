# MCP client configuration

Build the server before adding it to a client:

```bash
bun install
bun run build
```

Use an absolute path for `dist/index.js`. The process communicates exclusively over standard input/output, so do not configure a URL or port.

## Claude Desktop

Open Claude Desktop's developer settings and edit its MCP configuration file. Add the following entry under `mcpServers`, replacing `/absolute/path/to/nba-mcp` with this repository's absolute path:

```json
{
  "mcpServers": {
    "nba-mcp": {
      "command": "bun",
      "args": ["/absolute/path/to/nba-mcp/dist/index.js"],
      "env": {
        "NBA_MCP_PROVIDER": "mock"
      }
    }
  }
}
```

Restart Claude Desktop after saving. `mock` is deterministic and needs no credentials. To use the public nba.com adapter instead, set `NBA_MCP_PROVIDER` to `nba-com`; see the provider limitations in the README.

## Visual Studio Code

Create `.vscode/mcp.json` in the workspace (or use the **MCP: Open User Configuration** command for a user-level configuration):

```json
{
  "servers": {
    "nba-mcp": {
      "type": "stdio",
      "command": "bun",
      "args": ["/absolute/path/to/nba-mcp/dist/index.js"],
      "env": {
        "NBA_MCP_PROVIDER": "mock"
      }
    }
  }
}
```

Start or restart the server from VS Code's MCP view after changing the configuration.

## Verify the connection

Ask the connected client to call `get_server_capabilities`. With the configuration above, its `activeProvider` should be `mock`. Then try `get_live_games` or ask: “What NBA games are live right now?”

If the client cannot start the server, confirm that `bun` is available to the desktop application's environment and that the path in `args` is absolute. Run `bun /absolute/path/to/nba-mcp/dist/index.js` from a terminal to confirm the process starts without an immediate error.
