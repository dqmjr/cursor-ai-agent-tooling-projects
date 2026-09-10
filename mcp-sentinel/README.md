# mcp-sentinel

[![CI](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml/badge.svg)](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../LICENSE)

**MCP tool calls are invisible.** mcp-sentinel sits between your host and existing MCP servers, applies policy, redacts secrets, and writes a tamper-evident audit trail you can browse locally.

![Architecture](./docs/architecture.svg)

```text
Before:  Host ──────────────────────────────► MCP servers   (no logs, no policy)
After:   Host ──► mcp-sentinel ──► MCP servers
                      │
                      ├── YAML allow / deny / confirm
                      ├── secret redaction
                      └── hash-chained SQLite + live dashboard
```

Part of [cursor-ai-agent-tooling-projects](https://github.com/dqmjr/cursor-ai-agent-tooling-projects).

## 60-second demo

```bash
# From this repo
npm install && npm run build
npm run demo && npm run demo:dashboard
# → http://127.0.0.1:3921

# Or install from npm (AI/search-friendly package name)
npm i -g mcp-audit-gateway
mcp-audit-gateway --help
```

> **npm name:** `mcp-audit-gateway` (the name `mcp-sentinel` was already taken on npm).  
> CLI aliases: `mcp-audit-gateway` and `mcp-sentinel`.

## Install into Cursor

**Option A — npx (recommended for users)**

```json
{
  "mcpServers": {
    "sentinel": {
      "command": "npx",
      "args": ["-y", "mcp-audit-gateway", "proxy", "--config", "/ABS/PATH/sentinel.json"]
    }
  }
}
```

Copy [`examples/cursor.mcp.json`](./examples/cursor.mcp.json) and point `--config` at your `sentinel.json` (start from [`examples/sentinel.json`](./examples/sentinel.json)).

## CLI

| Command | What it does |
|---------|----------------|
| `proxy -c <config>` | Stdio MCP gateway (what the host launches) |
| `dashboard -c <config>` | Local UI + REST + **live SSE** stream |
| `verify -c <config>` | Check hash chain (exit 1 if broken) |
| `stats` / `events` | Headless inspection |

```bash
npx tsx src/cli.ts proxy -c examples/sentinel.json
npx tsx src/cli.ts dashboard -c examples/smoke-config.json
npx tsx src/cli.ts verify -c examples/smoke-config.json
```

## Policy (YAML)

```yaml
defaultAction: allow
redactPatterns: [password, secret, token, apiKey]
rules:
  - match: "shell/rm_*"
    action: deny
    reason: "Destructive shell tools are blocked"
  - match: "filesystem/write_*"
    action: confirm
```

Paths resolve **relative to the config file**. Child server `cwd` defaults to that directory.

## Why it exists

The MCP ecosystem has thousands of servers and almost no governance layer. When an agent touches production-ish tools, teams need forensics and policy — locally, without shipping prompts to a SaaS.

## License

Apache-2.0 — [LICENSE](./LICENSE) · [NOTICE](./NOTICE)

Promo draft: [docs/SHOW_HN.md](../docs/SHOW_HN.md)
