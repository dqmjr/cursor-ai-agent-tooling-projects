# Contributing

Thanks for contributing to **cursor-ai-agent-tooling-projects**.

## Ground rules

- Keep each package small and focused.
- Prefer well-known dependencies.
- **No telemetry** by default.
- Features must work from the CLI without a GUI when a dashboard exists.
- English for docs, code comments, and commit messages.
- Apache-2.0 for all contributions.

## Setup

```bash
npm run setup
npm test
npm run build
```

Work inside the package you are changing (`mcp-sentinel`, `agent-control-room`, or `verify-mcp`).

## Pull requests

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Add or update tests for behavior changes.
3. Run `npm test` and `npm run lint` for touched packages (or root `npm test` / `npm run lint`).
4. Fill in the PR template.

## Commit style

Short imperative subject, optional body explaining *why*:

```text
fix(mcp-sentinel): resolve audit paths relative to config file
```

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
