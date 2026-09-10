#!/usr/bin/env node
/**
 * mcp-sentinel CLI
 *
 *   mcp-sentinel proxy --config ./sentinel.json
 *   mcp-sentinel dashboard --config ./sentinel.json
 *   mcp-sentinel verify --config ./sentinel.json
 *   mcp-sentinel stats --config ./sentinel.json
 */

import { Command } from "commander";
import { loadConfig } from "./config.js";
import { PolicyEngine } from "./policy/engine.js";
import { AuditLog } from "./audit/log.js";
import { startProxy } from "./proxy/server.js";
import { startDashboard } from "./dashboard/server.js";

const program = new Command();

program
  .name("mcp-sentinel")
  .description("MCP observability & policy gateway")
  .version("0.1.0");

program
  .command("proxy")
  .description("Run as an MCP stdio proxy in front of configured servers")
  .requiredOption("-c, --config <path>", "Path to sentinel.json / mcp.json")
  .action(async (opts: { config: string }) => {
    const config = loadConfig(opts.config);
    const policy = PolicyEngine.fromFile(config.policyFile);
    const audit = new AuditLog(config.auditDb!);
    await startProxy({ config, policy, audit });
  });

program
  .command("dashboard")
  .description("Serve the local audit dashboard")
  .requiredOption("-c, --config <path>", "Path to sentinel.json")
  .option("-p, --port <number>", "Port override")
  .action(async (opts: { config: string; port?: string }) => {
    const config = loadConfig(opts.config);
    const audit = new AuditLog(config.auditDb!);
    const port = opts.port ? Number(opts.port) : config.dashboardPort!;
    startDashboard({ audit, port });
  });

program
  .command("verify")
  .description("Verify the tamper-evident audit hash chain")
  .requiredOption("-c, --config <path>", "Path to sentinel.json")
  .action((opts: { config: string }) => {
    const config = loadConfig(opts.config);
    const audit = new AuditLog(config.auditDb!);
    const result = audit.verifyChain();
    console.log(JSON.stringify(result, null, 2));
    audit.close();
    process.exit(result.ok ? 0 : 1);
  });

program
  .command("stats")
  .description("Print aggregate audit statistics")
  .requiredOption("-c, --config <path>", "Path to sentinel.json")
  .action((opts: { config: string }) => {
    const config = loadConfig(opts.config);
    const audit = new AuditLog(config.auditDb!);
    console.log(JSON.stringify(audit.stats(), null, 2));
    audit.close();
  });

program
  .command("events")
  .description("List recent audit events as JSON")
  .requiredOption("-c, --config <path>", "Path to sentinel.json")
  .option("-n, --limit <number>", "Max rows", "50")
  .option("--session <id>", "Filter by session id")
  .action((opts: { config: string; limit: string; session?: string }) => {
    const config = loadConfig(opts.config);
    const audit = new AuditLog(config.auditDb!);
    const rows = audit.list({
      limit: Number(opts.limit),
      sessionId: opts.session,
    });
    console.log(JSON.stringify(rows, null, 2));
    audit.close();
  });

await program.parseAsync(process.argv);
