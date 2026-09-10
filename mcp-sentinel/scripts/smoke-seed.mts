/**
 * Smoke seed for mcp-sentinel audit CLI.
 * Writes into the same DB path that examples/smoke-config.json resolves to.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditLog } from "../src/audit/log.js";
import { PolicyEngine } from "../src/policy/engine.js";
import { loadConfig } from "../src/config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = loadConfig(resolve(root, "examples/smoke-config.json"));
const audit = new AuditLog(config.auditDb!);
const policy = PolicyEngine.fromFile(config.policyFile);

const denied = policy.evaluate("shell", "rm_rf");
if (denied.action !== "deny") {
  console.error("expected deny for shell/rm_rf, got", denied);
  process.exit(1);
}

audit.append({
  sessionId: "smoke",
  serverName: "echo",
  toolName: "echo",
  arguments: policy.redact({ message: "hi", secret: "s3cr3t" }),
  result: { ok: true },
  isError: false,
  policyAction: "allow",
  durationMs: 2,
  createdAt: new Date().toISOString(),
});

const verified = audit.verifyChain();
const stats = audit.stats();
console.log(JSON.stringify({ db: config.auditDb, verified, stats, denied }, null, 2));
audit.close();

if (!verified.ok || stats.total < 1) process.exit(1);
