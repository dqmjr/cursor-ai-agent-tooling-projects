# mcp-sentinel

**MCP observability & policy gateway** — a transparent proxy that sits in front of your existing MCP servers, logs every tool call into a tamper-evident audit trail, enforces YAML allow/deny rules, and ships a local dashboard for session timelines and call replay.

> Before: MCP tool calls from Cursor / Claude Code / any host are invisible.  
> After: every call is policy-checked, redacted, hash-chained, and browsable locally.

## Why

The MCP marketplace has thousands of servers but almost no **governance layer**. When an agent queries a database or runs a shell tool, there is usually no forensic trail of who called what, with which arguments, or whether it was allowed. mcp-sentinel is that missing layer — small, self-hosted, no telemetry.

## Features

- **Transparent proxy** — point your client at sentinel instead of each server; config is `mcp.json`-compatible
- **Hash-chained audit log** — SQLite rows linked by SHA-256; `mcp-sentinel verify` detects tampering
- **YAML policy engine** — allow / deny / confirm per `server/tool` glob; redact secrets before they hit the log
- **Local dashboard** — session list, timeline, argument/result replay, chain status
- **Headless-first CLI** — every feature works without the GUI

## 60-second quickstart

```bash
npm install
npm run build

# Run the proxy (stdio). Wire this into Cursor/Claude as a single MCP server.
npx tsx src/cli.ts proxy --config examples/sentinel.json

# In another terminal: browse the audit log
npx tsx src/cli.ts dashboard --config examples/sentinel.json
# open http://127.0.0.1:3920
```

### Cursor / Claude `mcp.json`

```json
{
  "mcpServers": {
    "sentinel": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-sentinel/src/cli.ts", "proxy", "--config", "/absolute/path/to/mcp-sentinel/examples/sentinel.json"]
    }
  }
}
```

Downstream servers are defined inside `examples/sentinel.json` (or your own config). Tools are exposed as `serverName__toolName`.

## CLI

| Command | Purpose |
|---------|---------|
| `proxy -c <config>` | Stdio MCP proxy (what the host launches) |
| `dashboard -c <config> [-p port]` | Local web UI + JSON API |
| `verify -c <config>` | Exit 0 if the hash chain is intact |
| `stats -c <config>` | Aggregate counters |
| `events -c <config> [-n 50]` | Dump recent events as JSON |

## Policy example

```yaml
defaultAction: allow
redactPatterns: [password, secret, token, apiKey]
rules:
  - match: "shell/rm_*"
    action: deny
    reason: "Destructive shell tools are blocked"
  - match: "filesystem/write_*"
    action: confirm
    reason: "Writes are flagged for dashboard review"
```

`confirm` is recorded in the audit trail for human review (headless hosts cannot interactively prompt).

## Architecture

```
MCP Host (Cursor / Claude / …)
        │ stdio
        ▼
   mcp-sentinel proxy
        │  policy + audit
        ├────────────► SQLite (.sentinel/audit.db)
        │
        ▼ stdio (spawned)
  Downstream MCP servers
```

## Development

```bash
npm test
npm run lint
npm run build:dashboard
```

## Origin

Created September 2026 as an open-source response to the missing MCP governance / forensics layer discussed across the agent tooling ecosystem. Authorship is established via this repository's git history, Apache-2.0 LICENSE, and NOTICE file.

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
