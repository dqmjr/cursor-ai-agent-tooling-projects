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
# npm (searchable package name)
npm i -g verify-artifact-mcp

# or from this repo
npm install
npm run build
npm test
```

> **npm name:** `verify-artifact-mcp` (`verify-mcp` was already taken on npm).  
> CLI aliases: `verify-artifact-mcp` and `verify-mcp`.

## Quick start

```bash
verify-artifact-mcp packs
verify-artifact-mcp run --path README.md -p markdown-links
verify-artifact-mcp run --path ./src -p secrets
```

### MCP host config (npx)

```json
{
  "mcpServers": {
    "verify": {
      "command": "npx",
      "args": ["-y", "verify-artifact-mcp", "serve"]
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
