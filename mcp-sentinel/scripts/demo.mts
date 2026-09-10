/**
 * Demo seed — realistic audit timeline for screenshots / walkthroughs.
 *
 *   npm run demo
 *   npm run demo:dashboard
 */
import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditLog } from "../src/audit/log.js";
import { PolicyEngine } from "../src/policy/engine.js";
import { loadConfig } from "../src/config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = loadConfig(resolve(root, "examples/smoke-config.json"));

// Fresh demo DB each run
rmSync(config.auditDb!, { force: true });
rmSync(`${config.auditDb!}-journal`, { force: true });
rmSync(`${config.auditDb!}-wal`, { force: true });
rmSync(`${config.auditDb!}-shm`, { force: true });

const audit = new AuditLog(config.auditDb!);
const policy = PolicyEngine.fromFile(config.policyFile);
const sessionId = `demo-${new Date().toISOString().slice(0, 10)}`;
const now = Date.now();

function at(offsetMs: number): string {
  return new Date(now + offsetMs).toISOString();
}

const scenarios: Array<{
  server: string;
  tool: string;
  args: unknown;
  result: unknown;
  isError?: boolean;
  ms: number;
  t: number;
}> = [
  {
    server: "filesystem",
    tool: "read_file",
    args: { path: "src/auth.ts" },
    result: { content: "export function login() { /* … */ }" },
    ms: 12,
    t: 0,
  },
  {
    server: "filesystem",
    tool: "write_file",
    args: { path: "src/auth.ts", content: "patched", apiKey: "sk-live-REDACT-ME" },
    result: { ok: true },
    ms: 28,
    t: 800,
  },
  {
    server: "shell",
    tool: "run",
    args: { command: "npm test" },
    result: { exitCode: 0, stdout: "ok" },
    ms: 420,
    t: 1600,
  },
  {
    server: "shell",
    tool: "rm_rf",
    args: { path: "/tmp/workspace" },
    result: { denied: true },
    isError: true,
    ms: 1,
    t: 2400,
  },
  {
    server: "echo",
    tool: "echo",
    args: { message: "hello from demo", secret: "super-secret-token" },
    result: { content: [{ type: "text", text: "hello from demo" }] },
    ms: 4,
    t: 3000,
  },
];

for (const s of scenarios) {
  const decision = policy.evaluate(s.server, s.tool);
  const action = decision.action;
  audit.append({
    sessionId,
    serverName: s.server,
    toolName: s.tool,
    arguments: policy.redact(s.args, decision.rule?.redactArgs ?? []),
    result:
      action === "deny"
        ? { denied: true, reason: decision.reason }
        : policy.redact(s.result),
    isError: action === "deny" ? true : Boolean(s.isError),
    policyAction: action,
    durationMs: s.ms,
    createdAt: at(s.t),
  });
}

const verified = audit.verifyChain();
const stats = audit.stats();
audit.close();

console.log(`
mcp-sentinel demo ready
───────────────────────
db:       ${config.auditDb}
session:  ${sessionId}
events:   ${stats.total}
denied:   ${stats.denied}
chain:    ${verified.ok ? "ok" : "BROKEN"}

Next:
  npx tsx src/cli.ts dashboard -c examples/smoke-config.json
  open http://127.0.0.1:3921
`);

if (!verified.ok || stats.total < 1) process.exit(1);
