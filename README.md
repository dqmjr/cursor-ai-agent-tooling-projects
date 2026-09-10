# Cursor AI Agent Tooling

[![CI](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml/badge.svg)](https://github.com/dqmjr/cursor-ai-agent-tooling-projects/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

Local-first **TypeScript** tools for the AI coding-agent stack: MCP governance, a multi-agent control plane, and verification-as-a-tool.

No cloud lock-in. No telemetry by default. CLI-first, dashboards optional.

---

## Projects

| Package | Role | Status |
|---------|------|--------|
| [`mcp-sentinel`](./mcp-sentinel) | Transparent MCP proxy · YAML policy · hash-chained audit · local dashboard | `0.1.0` |
| [`agent-control-room`](./agent-control-room) | Parallel-agent kanban · approvals · diff preview · git rollback | `0.1.0` |
| [`verify-mcp`](./verify-mcp) | MCP `verify` tool · markdown / JSON Schema / secrets packs | `0.1.0` |

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  MCP Hosts      │     │  Coding Agents       │     │  Artifacts  │
│  Cursor/Claude  │     │  Claude/Cursor/…     │     │  docs/json  │
└────────┬────────┘     └──────────┬───────────┘     └──────┬──────┘
         │                         │                        │
         ▼                         ▼                        ▼
   mcp-sentinel            agent-control-room          verify-mcp
   policy + audit          timeline + approve          pass / fail
```

More detail: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Requirements

- Node.js **18+** (20+ recommended)
- npm 10+

## Quick start

```bash
git clone https://github.com/dqmjr/cursor-ai-agent-tooling-projects.git
cd cursor-ai-agent-tooling-projects
npm run setup    # install all packages
npm test         # run every test suite
npm run build    # build all packages
```

### Flagship demo — mcp-sentinel

```bash
cd mcp-sentinel
npm run demo
npm run demo:dashboard
# → http://127.0.0.1:3921
```

Ready-to-post draft: [docs/SHOW_HN.md](./docs/SHOW_HN.md)

### Try each tool

```bash
npm run demo:sentinel   # from repo root (smoke + dashboard)
npm run demo:acr        # agent control room UI
npm run demo:verify     # verification CLI
```

---

## Repository layout

```text
.
├── mcp-sentinel/           MCP observability & policy gateway
├── agent-control-room/     Multi-agent session dashboard (npm workspaces)
├── verify-mcp/             Verification-as-a-tool MCP server
├── docs/                   Architecture notes
├── .github/                CI, issue & PR templates
├── LICENSE                 Apache-2.0
└── package.json            Root scripts (setup / test / build / demo)
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: [SECURITY.md](./SECURITY.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

Apache License 2.0 — [LICENSE](./LICENSE) · [NOTICE](./NOTICE)

© 2026 [dqmjr](https://github.com/dqmjr)
