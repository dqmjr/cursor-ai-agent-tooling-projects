import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("resolves audit/policy paths and defaults server cwd to config dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "sentinel-cfg-"));
    mkdirSync(join(dir, "cfg"));
    const configPath = join(dir, "cfg", "sentinel.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          echo: { command: "node", args: ["./echo.mjs"] },
        },
        policyFile: "./policy.yaml",
        auditDb: "../data/audit.db",
      })
    );
    writeFileSync(join(dir, "cfg", "policy.yaml"), "defaultAction: allow\nrules: []\n");

    const cfg = loadConfig(configPath);
    assert.equal(cfg.mcpServers.echo.cwd, join(dir, "cfg"));
    assert.equal(cfg.auditDb, join(dir, "data", "audit.db"));
    assert.equal(cfg.policyFile, join(dir, "cfg", "policy.yaml"));

    rmSync(dir, { recursive: true, force: true });
  });
});
