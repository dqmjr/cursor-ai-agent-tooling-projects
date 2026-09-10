/**
 * verify-mcp MCP server — exposes list_packs + verify tools.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getPack, listPacks } from "./packs/index.js";
import type { VerifyResult } from "./types.js";

export async function startServer(): Promise<Server> {
  const server = new Server(
    { name: "verify-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_packs",
        description: "List available verification packs",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "verify",
        description:
          "Run one or more verifier packs against a path (or inline content). " +
          "Agents should call this before declaring a non-code task done.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File or directory to verify",
            },
            content: {
              type: "string",
              description: "Optional inline content (skips reading path from disk)",
            },
            packs: {
              type: "array",
              items: { type: "string" },
              description:
                "Pack names to run (default: all applicable / all registered)",
            },
            options: {
              type: "object",
              description: "Pack-specific options (e.g. schemaPath for json-schema)",
            },
            cwd: {
              type: "string",
              description: "Working directory for relative paths",
            },
          },
          required: ["path"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (name === "list_packs") {
      const packs = listPacks().map((p) => ({
        name: p.name,
        description: p.description,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(packs, null, 2) }],
      };
    }

    if (name === "verify") {
      const path = String(args.path ?? "");
      if (!path) {
        return {
          content: [{ type: "text", text: "path is required" }],
          isError: true,
        };
      }
      const requested = Array.isArray(args.packs)
        ? (args.packs as string[])
        : listPacks().map((p) => p.name);

      const results: VerifyResult[] = [];
      for (const packName of requested) {
        const pack = getPack(packName);
        if (!pack) {
          results.push({
            pack: packName,
            pass: false,
            findings: [
              { severity: "error", message: `Unknown pack: ${packName}` },
            ],
            summary: `Unknown pack: ${packName}`,
          });
          continue;
        }
        const result = await pack.verify({
          path,
          content: typeof args.content === "string" ? args.content : undefined,
          options: (args.options as Record<string, unknown>) ?? undefined,
          cwd: typeof args.cwd === "string" ? args.cwd : undefined,
        });
        results.push(result);
      }

      const pass = results.every((r) => r.pass);
      const payload = {
        pass,
        results,
        summary: pass
          ? `All ${results.length} pack(s) passed`
          : `${results.filter((r) => !r.pass).length}/${results.length} pack(s) failed`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        isError: !pass,
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[verify-mcp] ready on stdio");
  return server;
}
