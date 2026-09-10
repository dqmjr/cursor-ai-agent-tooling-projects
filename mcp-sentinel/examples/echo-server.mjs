#!/usr/bin/env node
/**
 * Minimal MCP echo server used in examples and integration tests.
 * Speaks JSON-RPC over stdio with a single `echo` tool.
 */

import { createInterface } from "node:readline";

const tools = [
  {
    name: "echo",
    description: "Echo back the provided message",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Text to echo" },
        secret: { type: "string", description: "Optional secret (should be redacted in audit)" },
      },
      required: ["message"],
    },
  },
  {
    name: "fail",
    description: "Always returns an error (for testing)",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
    },
  },
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function respondError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "echo-server", version: "0.1.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }
  if (method === "tools/list") {
    respond(id, { tools });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (name === "echo") {
      respond(id, {
        content: [{ type: "text", text: String(args.message ?? "") }],
      });
      return;
    }
    if (name === "fail") {
      respond(id, {
        content: [{ type: "text", text: args.reason ?? "intentional failure" }],
        isError: true,
      });
      return;
    }
    respondError(id, -32601, `Unknown tool: ${name}`);
    return;
  }
  if (method === "ping") {
    respond(id, {});
    return;
  }
  if (id !== undefined) {
    respondError(id, -32601, `Method not found: ${method}`);
  }
});

process.stderr.write("[echo-server] ready on stdio\n");
