# verify-mcp

[![CI](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml/badge.svg)](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../LICENSE)

**Verification-as-a-tool** for AI agents. Exposes MCP `verify` so a model can check an artifact before saying “done” — especially when there is no compiler or test suite.

Part of [cursor-ai-agent-tooling-projects](https://github.com/dqmjr/cursor-ai-agent-tooling-projects).

## Packs

| Pack | Checks |
|------|--------|
| `markdown-links` | Relative markdown links exist on disk |
| `json-schema` | JSON matches `options.schema` / `options.schemaPath` |
| `secrets` | Heuristic scan for keys, tokens, private keys |

## Install

```bash
npm install
npm run build
npm test
```

## Quick start

```bash
node dist/cli.js packs
node dist/cli.js run --path README.md -p markdown-links
node dist/cli.js run --path ./src -p secrets
```

### MCP host config

```json
{
  "mcpServers": {
    "verify": {
      "command": "node",
      "args": ["/ABS/PATH/verify-mcp/dist/cli.js", "serve"]
    }
  }
}
```

Ask the agent: *Call `verify` on `docs/guide.md` with pack `markdown-links` before finishing.*

## Tools

- `list_packs`
- `verify` — `{ path, packs?, content?, options?, cwd? }` → `{ pass, results, summary }`

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
