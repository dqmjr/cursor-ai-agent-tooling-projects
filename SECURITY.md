# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `0.1.x` | Yes |

These tools are local-first. Treat audit DBs and agent session stores as sensitive.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email the maintainer via GitHub: [@dqmjr](https://github.com/dqmjr) (use a private security advisory on the repository when available).

Include:

- Affected package (`mcp-sentinel` / `agent-control-room` / `verify-mcp`)
- Impact and reproduction steps
- Your environment (OS, Node version)

You should receive an acknowledgement within a few days.

## Safe defaults

- Bind dashboards to `127.0.0.1` only unless you intentionally expose them.
- Do not commit `.sentinel/`, `.acr/`, or real audit databases.
- Redact secrets in logs (mcp-sentinel policy `redactPatterns`).
