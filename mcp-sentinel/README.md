# mcp-sentinel

[![CI](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml/badge.svg)](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../LICENSE)

Transparent **MCP proxy** with YAML policy, hash-chained audit logging, and a local dashboard.

Point Cursor / Claude Code / any MCP host at sentinel instead of each server. Every tool call is policy-checked, redacted, logged, and browsable.

```text
Host ──stdio──► mcp-sentinel ──stdio──► your MCP servers
                      │
                      ▼
                 SQLite audit + dashboard
```

Part of [cursor-ai-agent-tooling-projects](https://github.com/dqmjr/cursor-ai-agent-tooling-projects).

## Install

```bash
npm install
npm run build
npm test
```

## Quick start

```bash
# Seed + browse an example audit DB
npm run smoke
npx tsx src/cli.ts dashboard -c examples/smoke-config.json
# → http://127.0.0.1:3921

# Run as the MCP proxy (stdio) for your host
npx tsx src/cli.ts proxy -c examples/sentinel.json
```

### Wire into Cursor / Claude

```json
{
  "mcpServers": {
    "sentinel": {
      "command": "npx",
      "args": [
        "tsx",
        "/ABS/PATH/mcp-sentinel/src/cli.ts",
        "proxy",
        "--config",
        "/ABS/PATH/mcp-sentinel/examples/sentinel.json"
      ]
    }
  }
}
```

Downstream servers live in `sentinel.json` (same shape as `mcp.json`). Tools appear as `serverName__toolName`.

## CLI

| Command | What it does |
|---------|----------------|
| `proxy -c <config>` | Stdio MCP gateway |
| `dashboard -c <config> [-p port]` | Local UI + `/api/*` |
| `verify -c <config>` | Check hash chain (exit 1 if broken) |
| `stats -c <config>` | Counters |
| `events -c <config>` | Recent rows as JSON |

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

Paths in the config are resolved **relative to the config file**. Child server `cwd` defaults to that directory.

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
