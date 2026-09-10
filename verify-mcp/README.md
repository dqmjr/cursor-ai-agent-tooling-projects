# verify-mcp

**Verification-as-a-tool** for AI coding agents. Exposes a single MCP `verify` tool backed by pluggable packs so an agent can check an artifact *before* declaring a task done — especially useful when there is no compiler or `pytest` for the domain.

> Before: agent writes docs / configs / JSON and says “done” with no signal.  
> After: agent calls `verify` with packs like `markdown-links`, `json-schema`, `secrets`.

## Built-in packs

| Pack | What it checks |
|------|----------------|
| `markdown-links` | Relative markdown links resolve on disk |
| `json-schema` | JSON matches a provided schema (`options.schema` or `options.schemaPath`) |
| `secrets` | Heuristic scan for AWS keys, GitHub tokens, private keys, etc. |

## 60-second quickstart

```bash
npm install
npm run build

# CLI (no MCP host needed)
node dist/cli.js packs
node dist/cli.js run --path README.md -p markdown-links
node dist/cli.js run --path ./src -p secrets
```

### Cursor / Claude `mcp.json`

```json
{
  "mcpServers": {
    "verify": {
      "command": "node",
      "args": ["/absolute/path/to/verify-mcp/dist/cli.js", "serve"]
    }
  }
}
```

Then ask the agent:

> Before finishing, call the `verify` tool on `docs/guide.md` with pack `markdown-links`.

## MCP tools

- `list_packs` — enumerate registered packs
- `verify` — `{ path, packs?, content?, options?, cwd? }` → `{ pass, results, summary }`

## Extending

```ts
import { registerPack } from "verify-mcp";

registerPack({
  name: "my-domain",
  description: "Custom checks",
  async verify(ctx) {
    return { pack: "my-domain", pass: true, findings: [], summary: "ok" };
  },
});
```

## Origin

Created September 2026 to close the “verification harness outside of code” gap discussed in agent-harness writing. Authorship via git history + Apache-2.0 LICENSE / NOTICE.

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
