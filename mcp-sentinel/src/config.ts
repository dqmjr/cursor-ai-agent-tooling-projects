/**
 * Load and validate sentinel config files (JSON, mcp.json-compatible).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import type { SentinelConfig } from "./types.js";

const DEFAULT_AUDIT_DB = ".sentinel/audit.db";
const DEFAULT_DASHBOARD_PORT = 3920;

export function loadConfig(configPath: string): SentinelConfig & { configDir: string } {
  const abs = resolve(configPath);
  if (!existsSync(abs)) {
    throw new Error(`Config not found: ${abs}`);
  }

  const raw = JSON.parse(readFileSync(abs, "utf8")) as SentinelConfig;
  if (!raw.mcpServers || typeof raw.mcpServers !== "object") {
    throw new Error("Config must include an mcpServers object");
  }

  const configDir = dirname(abs);
  const auditDb = resolvePath(configDir, raw.auditDb ?? DEFAULT_AUDIT_DB);
  const policyFile = raw.policyFile
    ? resolvePath(configDir, raw.policyFile)
    : undefined;

  const mcpServers: SentinelConfig["mcpServers"] = {};
  for (const [name, server] of Object.entries(raw.mcpServers)) {
    mcpServers[name] = {
      ...server,
      // Default child cwd to the config directory so relative args resolve predictably.
      cwd: server.cwd ? resolvePath(configDir, server.cwd) : configDir,
    };
  }

  return {
    ...raw,
    mcpServers,
    auditDb,
    policyFile,
    dashboardPort: raw.dashboardPort ?? DEFAULT_DASHBOARD_PORT,
    sessionId: raw.sessionId ?? `session-${Date.now()}`,
    configDir,
  };
}

function resolvePath(base: string, p: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}
