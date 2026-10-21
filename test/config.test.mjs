import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config.js";

test("loadConfig accepts valid IANA timezones", () => {
  const config = loadConfig({ NBA_MCP_TIMEZONE: "Europe/London" });

  assert.equal(config.timezone, "Europe/London");
});

test("loadConfig rejects invalid timezones", () => {
  assert.throws(
    () => loadConfig({ NBA_MCP_TIMEZONE: "not/a-timezone" }),
    /NBA_MCP_TIMEZONE must be a valid IANA timezone/,
  );
});
