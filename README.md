# AI Agent Tooling

Three focused open-source tools for the AI coding-agent stack: **MCP governance**, a **multi-agent control plane**, and **verification-as-a-tool**.

| Project | One-liner |
|---------|-----------|
| **[mcp-sentinel](./mcp-sentinel)** | Transparent MCP proxy with policy rules + tamper-evident audit log + local dashboard |
| **[agent-control-room](./agent-control-room)** | Kanban + approvals + git rollback for parallel coding agents |
| **[verify-mcp](./verify-mcp)** | MCP `verify` tool with markdown / JSON Schema / secrets packs |

All TypeScript · Node 18+ · Apache-2.0 · local-first · no telemetry

## Quick start

```bash
# 1) MCP gateway
cd mcp-sentinel && npm install && npm test && npm run build
npx tsx src/cli.ts dashboard -c examples/smoke-config.json
# → http://127.0.0.1:3921

# 2) Agent control plane
cd ../agent-control-room && npm install && npm test && npm run build
node packages/core/dist/cli.js daemon --port 3930 --static packages/web/dist
# → http://127.0.0.1:3930

# 3) Verification MCP
cd ../verify-mcp && npm install && npm test && npm run build
node dist/cli.js run --path README.md -p markdown-links
```

## Why these three

The agent ecosystem grew fast; the missing layers are **observability/policy for MCP**, **human control over parallel agents**, and **verification when there is no compiler**. Each project is small, demo-driven, and usable from the CLI without a GUI.

## License

Apache License 2.0. See each project’s `LICENSE` and `NOTICE`.
