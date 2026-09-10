# Agent Control Room

Local **control plane for parallel coding agents** — live kanban, event timeline, approve/reject, diff preview, and git rollback.

```text
Claude Code / Cursor / any CLI
        │  hooks or JSONL
        ▼
   ACR daemon (HTTP + WS)
        │
        ▼
   Dashboard  http://127.0.0.1:3930
```

## Install

```bash
npm install
npm run build
npm test
```

## Quick start

```bash
# Terminal 1 — daemon + UI
node packages/core/dist/cli.js daemon --port 3930 --static packages/web/dist

# Terminal 2 — emit a demo session
node packages/core/dist/cli.js emit \
  --session demo-1 --type task_started --source generic \
  --title "Refactor payments" --cwd .

node packages/core/dist/cli.js emit \
  --session demo-1 --type waiting_for_approval \
  --message "About to rewrite src/pay.ts"
```

Open **http://127.0.0.1:3930**.

## Adapters

| Package | Use |
|---------|-----|
| `@acr/adapter-claude-code` | Claude Code hooks → ACR |
| `@acr/adapter-cursor` | Cursor hooks or JSONL tail → ACR |
| `@acr/adapter-generic` | stdin / JSON / JSONL ingest |

```bash
# Generic
node packages/adapters/generic/dist/cli.js --file examples/sample-event.json

# Cursor JSONL tail
node packages/adapters/cursor/dist/hook.js tail --file .cursor/agent-events.jsonl
```

## Event shape

```json
{
  "sessionId": "sess-123",
  "source": "claude-code",
  "type": "waiting_for_approval",
  "title": "Approve Write",
  "cwd": "/path/to/repo",
  "baseCommit": "abcdef"
}
```

`POST /api/events` · `POST /api/approve` · `POST /api/sessions/:id/rollback`

## Origin

Created September 2026. Authorship via git history, Apache-2.0 `LICENSE`, and `NOTICE`.

## License

Apache-2.0
