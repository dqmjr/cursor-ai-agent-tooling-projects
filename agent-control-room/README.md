# Agent Control Room

**Team devtools for a team of agents.** A local daemon + dashboard that gives you one place to watch parallel coding-agent sessions (Claude Code, Cursor, Codex, or anything that can POST JSON), approve risky steps, preview diffs, and roll back with git.

> Before: three agents running in three terminals, no shared timeline, no approve button, no undo.  
> After: kanban of sessions, live event stream, one-click approve/reject, hard reset to `baseCommit`.

## Why

Developers increasingly run **multiple** coding agents at once. Existing IDEs are built for one human thread. Agent Control Room is the missing control plane — explicitly called out in 2026 commentary as “team devtools, but for a team of agents.”

## Features

- **Normalized event schema** — `task_started`, `tool_call`, `file_changed`, `waiting_for_approval`, `completed`, …
- **Local Fastify daemon** — REST + WebSocket, SQLite-backed, no cloud, no telemetry
- **Kanban dashboard** — running / waiting / completed / failed columns
- **Diff preview + git rollback** — sessions carry `cwd` + `baseCommit`
- **Adapters**
  - `@acr/adapter-claude-code` — Claude Code hooks → ACR
  - `@acr/adapter-cursor` — Cursor hooks or JSONL tail → ACR
  - `@acr/adapter-generic` — stdin / JSONL / webhook-style ingest

## 60-second quickstart

```bash
npm install
npm run build

# Terminal 1 — daemon (also serves the built dashboard)
npm run start -w @acr/core -- daemon --port 3930 --static packages/web/dist

# open http://127.0.0.1:3930

# Terminal 2 — emit a demo event
node packages/core/dist/cli.js emit \
  --session demo-1 \
  --type task_started \
  --source generic \
  --title "Refactor payments" \
  --cwd . \
  --base-commit "$(git rev-parse HEAD)"

node packages/core/dist/cli.js emit \
  --session demo-1 \
  --type waiting_for_approval \
  --message "About to rewrite src/pay.ts"
```

## Event schema (minimal)

```json
{
  "sessionId": "sess-123",
  "source": "claude-code",
  "type": "waiting_for_approval",
  "title": "Approve Write",
  "cwd": "/path/to/repo",
  "baseCommit": "abcdef",
  "files": [{ "path": "src/a.ts", "kind": "modified", "diff": "-old\n+new\n" }]
}
```

POST to `http://127.0.0.1:3930/api/events`.

## Claude Code hooks

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{ "type": "command", "command": "node /path/to/packages/adapters/claude-code/dist/hook.js --phase pre" }]
    }],
    "PostToolUse": [{
      "hooks": [{ "type": "command", "command": "node /path/to/packages/adapters/claude-code/dist/hook.js --phase post" }]
    }],
    "Stop": [{
      "hooks": [{ "type": "command", "command": "node /path/to/packages/adapters/claude-code/dist/hook.js --phase stop" }]
    }]
  }
}
```

## Cursor adapter

```bash
# Hook mode (stdin JSON from Cursor hooks)
node packages/adapters/cursor/dist/hook.js --phase pre

# Or tail a JSONL file your wrapper writes
node packages/adapters/cursor/dist/hook.js tail --file .cursor/agent-events.jsonl
```

## Generic ingest

```bash
node packages/adapters/generic/dist/cli.js --file examples/sample-event.json
```

## Monorepo layout

```
packages/
  core/                 daemon, schema, SQLite, CLI
  web/                  React dashboard
  adapters/claude-code/ first adapter
  adapters/cursor/      second adapter
  adapters/generic/     JSONL / stdin helper
```

## Development

```bash
npm test
npm run lint
npm run build
```

## Origin

Created September 2026. Authorship is established via this repository's git history, Apache-2.0 LICENSE, and NOTICE file.

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
