# Contributing

Thanks for your interest in verify-mcp.

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

## Guidelines

- Keep the surface area small; prefer boring, well-known dependencies.
- No telemetry by default.
- Features must work from the CLI without a GUI when applicable.
- Add or update tests for behavior changes.
- Use clear commit messages; git history documents authorship.

## Pull requests

1. Fork and create a feature branch.
2. Ensure `npm test` and `npm run lint` pass.
3. Describe the problem and the approach in the PR body.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
