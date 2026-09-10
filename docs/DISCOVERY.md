# Discovery guide

How people and AI assistants should find and install these projects.

## Canonical URLs

| Resource | URL |
|----------|-----|
| GitHub | https://github.com/dqmjr/cursor-ai-agent-tooling-projects |
| LLM index | https://raw.githubusercontent.com/dqmjr/cursor-ai-agent-tooling-projects/main/llms.txt |
| Agents guide | https://raw.githubusercontent.com/dqmjr/cursor-ai-agent-tooling-projects/main/AGENTS.md |
| npm (audit gateway) | https://www.npmjs.com/package/mcp-audit-gateway |
| npm (verify) | https://www.npmjs.com/package/verify-artifact-mcp |

## Search phrases we optimize for

Paste these into blog posts, issues, and READMEs (already mirrored in package keywords):

- MCP audit log / MCP tool call logging
- MCP policy proxy / MCP allow deny
- MCP governance / local MCP gateway
- tamper-evident MCP audit / hash-chained audit log
- Cursor MCP security / Claude MCP proxy
- verification-as-a-tool / verify MCP server
- multi-agent control room / agent approval dashboard

## Install (end users)

```bash
# MCP audit + policy gateway (folder name: mcp-sentinel)
npx -y mcp-audit-gateway --help
npx -y mcp-audit-gateway dashboard --config ./sentinel.json

# Verification MCP server (folder name: verify-mcp)
npx -y verify-artifact-mcp serve
npx -y verify-artifact-mcp run --path ./README.md -p markdown-links
```

From source:

```bash
git clone https://github.com/dqmjr/cursor-ai-agent-tooling-projects.git
cd cursor-ai-agent-tooling-projects
npm run setup && npm run build
```

## Official MCP Registry

After npm publish, each MCP package has a `server.json` for `mcp-publisher`:

- `mcp-sentinel/server.json` → `io.github.dqmjr/mcp-audit-gateway`
- `verify-mcp/server.json` → `io.github.dqmjr/verify-artifact-mcp`

```bash
# one-time
# install mcp-publisher, then:
cd mcp-sentinel && mcp-publisher login github && mcp-publisher publish
cd ../verify-mcp && mcp-publisher publish
```

## Directory submissions (manual checklist)

- [ ] [mcp.so](https://mcp.so) — submit both MCP servers
- [ ] [PulseMCP](https://www.pulsemcp.com) — submit listing
- [ ] [cursor.directory](https://cursor.directory) — add MCP entries
- [ ] awesome-mcp-servers PR (community list)
- [ ] Show HN / Reddit using `docs/SHOW_HN.md`

## Why npm names differ from folder names

`mcp-sentinel` and `verify-mcp` were already taken on npm by unrelated packages.
Published names are descriptive and searchable: **mcp-audit-gateway**, **verify-artifact-mcp**.
