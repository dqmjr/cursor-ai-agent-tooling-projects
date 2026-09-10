# Show HN / social draft (copy-paste)

Use this when posting. Edit the first line if you want a different hook.

---

## Show HN title

**Show HN: mcp-sentinel – local audit + policy proxy for MCP tool calls**

## Body

MCP tool calls from Cursor/Claude/etc. are usually invisible. When an agent hits your filesystem, shell, or DB, there is often no forensic trail and no policy layer.

**mcp-sentinel** is a small local proxy you put in front of existing MCP servers:

- YAML allow / deny / confirm rules
- secret redaction before logging
- tamper-evident (hash-chained) SQLite audit log
- local dashboard with live timeline + call replay

No cloud, no telemetry. TypeScript / Node. Apache-2.0.

Repo: https://github.com/dqmjr/cursor-ai-agent-tooling-projects  
Package folder: `/mcp-sentinel`

60-second try:

```bash
git clone https://github.com/dqmjr/cursor-ai-agent-tooling-projects.git
cd cursor-ai-agent-tooling-projects/mcp-sentinel
npm install && npm run build && npm run demo
npx tsx src/cli.ts dashboard -c examples/smoke-config.json
# open http://127.0.0.1:3921
```

I'd love feedback on: policy language, confirm UX for headless hosts, and what you'd want in an export format.

---

## Short X / LinkedIn

MCP calls are invisible today. I open-sourced mcp-sentinel — a local policy + hash-chained audit proxy for Cursor/Claude MCP servers. No cloud, no telemetry.

https://github.com/dqmjr/cursor-ai-agent-tooling-projects
