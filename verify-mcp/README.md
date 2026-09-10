# verify-mcp

**Verification-as-a-tool** for AI agents. Exposes MCP `verify` so a model can check an artifact before saying “done” — especially when there is no compiler or test suite.

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

## Origin

Created September 2026. Authorship via git history, Apache-2.0 `LICENSE`, and `NOTICE`.

## License

Apache-2.0
