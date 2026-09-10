# Architecture

This repository is a **multi-package monorepo**. Each package is independently usable and versioned at `0.1.0`.

## Design principles

1. **Local-first** — data stays on disk (`SQLite`); no required cloud backend.
2. **CLI-first** — every capability works without a GUI; dashboards are optional.
3. **Boring stack** — TypeScript, Node 18+, well-known libraries.
4. **No telemetry by default.**
5. **Authorship clarity** — Apache-2.0 + NOTICE + git history.

## Package roles

### mcp-sentinel

Sits between an MCP host and downstream servers.

- Spawns configured stdio servers
- Applies YAML allow/deny/confirm + redaction
- Appends each tool call to a SHA-256 hash chain in SQLite
- Serves a local audit dashboard

### agent-control-room

Normalizes agent lifecycle events into one store and UI.

- Fastify HTTP + WebSocket daemon
- Adapters emit `task_started` / `tool_call` / `waiting_for_approval` / …
- Dashboard: kanban, timeline, approve/reject, git diff + rollback

### verify-mcp

Gives agents a structured “did I get this right?” signal for non-code artifacts.

- MCP tools: `list_packs`, `verify`
- Built-in packs: markdown links, JSON Schema, secrets heuristics
- Same packs runnable via CLI without an MCP host

## Data on disk

| Path | Owner |
|------|--------|
| `.sentinel/*.db` | mcp-sentinel audit DB |
| `.acr/*.db` | agent-control-room sessions |

Both are gitignored. Do not commit real audit/session databases.
