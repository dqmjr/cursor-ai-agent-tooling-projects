import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PolicyEngine, matchGlob } from "../src/policy/engine.js";
import { AuditLog } from "../src/audit/log.js";

describe("matchGlob", () => {
  it("matches wildcards", () => {
    assert.equal(matchGlob("shell/*", "shell/rm_rf"), true);
    assert.equal(matchGlob("*/write_*", "fs/write_file"), true);
    assert.equal(matchGlob("echo/echo", "echo/fail"), false);
  });
});

describe("PolicyEngine", () => {
  it("denies matching rules and redacts secrets", () => {
    const engine = new PolicyEngine({
      defaultAction: "allow",
      redactPatterns: ["secret", "token"],
      rules: [
        { match: "shell/rm_*", action: "deny", reason: "nope" },
        { match: "shell/*", action: "confirm" },
      ],
    });

    assert.equal(engine.evaluate("shell", "rm_rf").action, "deny");
    assert.equal(engine.evaluate("shell", "ls").action, "confirm");
    assert.equal(engine.evaluate("echo", "echo").action, "allow");

    const redacted = engine.redact({ message: "hi", secret: "s3cr3t", nested: { api_token: "x" } });
    assert.deepEqual(redacted, {
      message: "hi",
      secret: "[REDACTED]",
      nested: { api_token: "[REDACTED]" },
    });
  });
});

describe("AuditLog hash chain", () => {
  it("appends and verifies an intact chain", () => {
    const dir = mkdtempSync(join(tmpdir(), "sentinel-"));
    const dbPath = join(dir, "audit.db");
    const log = new AuditLog(dbPath);

    log.append({
      sessionId: "s1",
      serverName: "echo",
      toolName: "echo",
      arguments: { message: "a" },
      result: { ok: true },
      isError: false,
      policyAction: "allow",
      durationMs: 3,
      createdAt: new Date().toISOString(),
    });
    log.append({
      sessionId: "s1",
      serverName: "echo",
      toolName: "fail",
      arguments: {},
      result: { error: "x" },
      isError: true,
      policyAction: "allow",
      durationMs: 1,
      createdAt: new Date().toISOString(),
    });

    const verified = log.verifyChain();
    assert.equal(verified.ok, true);
    assert.equal(verified.checked, 2);

    const stats = log.stats();
    assert.equal(stats.total, 2);
    assert.equal(stats.errors, 1);

    log.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
