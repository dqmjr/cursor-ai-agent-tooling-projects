# Publish to npm (required for AI / registry discovery)

Packages are ready. Current npm credentials (`npm whoami` → `kz-statdata`) **cannot publish** (403/404). Do this once on your machine:

## 1. Login with a publish-capable token

1. https://www.npmjs.com/settings/~/tokens  
2. Create **Granular Access Token** → **Read and write**  
3. Or classic token with publish permission  
4. Enable 2FA / bypass as required by npm

```bash
npm logout
npm login
npm whoami
```

## 2. Publish

```bash
cd mcp-sentinel
npm publish --access public

cd ../verify-mcp
npm publish --access public
```

Package names (searchable; `mcp-sentinel` / `verify-mcp` were already taken):

- [`mcp-audit-gateway`](https://www.npmjs.com/package/mcp-audit-gateway)
- [`verify-artifact-mcp`](https://www.npmjs.com/package/verify-artifact-mcp)

## 3. Official MCP Registry (feeds VS Code `@mcp`, PulseMCP, etc.)

```bash
# https://github.com/modelcontextprotocol/publisher
mcp-publisher login github
cd mcp-sentinel && mcp-publisher publish
cd ../verify-mcp && mcp-publisher publish
```

Manifests already exist: `mcp-sentinel/server.json`, `verify-mcp/server.json`.

## 4. Until npm is live — install from GitHub Release

```bash
npm i -g https://github.com/dqmjr/cursor-ai-agent-tooling-projects/releases/download/v0.1.1/mcp-audit-gateway-0.1.0.tgz
npm i -g https://github.com/dqmjr/cursor-ai-agent-tooling-projects/releases/download/v0.1.1/verify-artifact-mcp-0.1.0.tgz
```

Or clone:

```bash
git clone https://github.com/dqmjr/cursor-ai-agent-tooling-projects.git
```
