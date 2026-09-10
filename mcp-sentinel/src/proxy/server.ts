/**
 * Transparent MCP proxy: connects to downstream stdio servers and re-exposes
 * their tools under a single sentinel facade with policy + audit hooks.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { DownstreamServerConfig, SentinelConfig } from "../types.js";
import { PolicyEngine } from "../policy/engine.js";
import { AuditLog } from "../audit/log.js";

interface Downstream {
  name: string;
  client: Client;
  tools: Tool[];
}

export interface ProxyOptions {
  config: SentinelConfig & { configDir: string };
  policy: PolicyEngine;
  audit: AuditLog;
}

/**
 * Start the sentinel as an MCP server on stdio, forwarding to configured
 * downstream servers. Tool names are prefixed as `server__tool` to avoid clashes.
 */
export async function startProxy(opts: ProxyOptions): Promise<Server> {
  const { config, policy, audit } = opts;
  const sessionId = config.sessionId ?? `session-${Date.now()}`;
  const downstreams: Downstream[] = [];

  for (const [name, serverCfg] of Object.entries(config.mcpServers)) {
    const ds = await connectDownstream(name, serverCfg);
    downstreams.push(ds);
    console.error(`[sentinel] connected downstream "${name}" (${ds.tools.length} tools)`);
  }

  const toolIndex = new Map<string, { downstream: Downstream; originalName: string }>();
  for (const ds of downstreams) {
    for (const tool of ds.tools) {
      const exposed = `${ds.name}__${tool.name}`;
      toolIndex.set(exposed, { downstream: ds, originalName: tool.name });
    }
  }

  const server = new Server(
    { name: "mcp-sentinel", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [];
    for (const ds of downstreams) {
      for (const tool of ds.tools) {
        tools.push({
          ...tool,
          name: `${ds.name}__${tool.name}`,
          description: `[via ${ds.name}] ${tool.description ?? ""}`.trim(),
        });
      }
    }
    // Built-in introspection tools
    tools.push({
      name: "sentinel_audit_stats",
      description: "Return aggregate audit statistics for this sentinel instance.",
      inputSchema: { type: "object", properties: {} },
    });
    tools.push({
      name: "sentinel_verify_chain",
      description: "Verify the tamper-evident hash chain of the audit log.",
      inputSchema: { type: "object", properties: {} },
    });
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments ?? {};
    const started = Date.now();

    if (toolName === "sentinel_audit_stats") {
      const stats = audit.stats();
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }
    if (toolName === "sentinel_verify_chain") {
      const result = audit.verifyChain();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok,
      };
    }

    const entry = toolIndex.get(toolName);
    if (!entry) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    const { downstream, originalName } = entry;
    const decision = policy.evaluate(downstream.name, originalName);
    const redactedArgs = policy.redact(args, decision.rule?.redactArgs ?? []);

    if (decision.action === "deny") {
      const createdAt = new Date().toISOString();
      audit.append({
        sessionId,
        serverName: downstream.name,
        toolName: originalName,
        arguments: redactedArgs,
        result: { denied: true, reason: decision.reason },
        isError: true,
        policyAction: "deny",
        durationMs: Date.now() - started,
        createdAt,
      });
      return {
        content: [
          {
            type: "text",
            text: `Denied by sentinel policy: ${decision.reason ?? decision.rule?.match ?? "deny"}`,
          },
        ],
        isError: true,
      };
    }

    // "confirm" is logged as such; headless hosts cannot interactively confirm,
    // so we allow the call but flag it in the audit trail for dashboard review.
    try {
      const result = await downstream.client.callTool({
        name: originalName,
        arguments: args as Record<string, unknown>,
      });
      const durationMs = Date.now() - started;
      const isError = Boolean((result as { isError?: boolean }).isError);
      const redactedResult = policy.redact(result);

      audit.append({
        sessionId,
        serverName: downstream.name,
        toolName: originalName,
        arguments: redactedArgs,
        result: redactedResult,
        isError,
        policyAction: decision.action,
        durationMs,
        createdAt: new Date().toISOString(),
      });

      return result as {
        content: Array<{ type: string; text?: string }>;
        isError?: boolean;
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit.append({
        sessionId,
        serverName: downstream.name,
        toolName: originalName,
        arguments: redactedArgs,
        result: { error: message },
        isError: true,
        policyAction: decision.action,
        durationMs: Date.now() - started,
        createdAt: new Date().toISOString(),
      });
      return {
        content: [{ type: "text", text: `Downstream error: ${message}` }],
        isError: true,
      };
    }
  });

  // Best-effort resource / prompt forwarding from the first downstream that supports them.
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [];
    for (const ds of downstreams) {
      try {
        const res = await ds.client.listResources();
        for (const r of res.resources ?? []) {
          resources.push({
            ...r,
            uri: `sentinel://${ds.name}/${r.uri}`,
            name: `${ds.name}/${r.name}`,
          });
        }
      } catch {
        // Downstream may not support resources.
      }
    }
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const m = /^sentinel:\/\/([^/]+)\/(.+)$/.exec(uri);
    if (!m) {
      throw new Error(`Invalid sentinel resource URI: ${uri}`);
    }
    const [, serverName, originalUri] = m;
    const ds = downstreams.find((d) => d.name === serverName);
    if (!ds) throw new Error(`Unknown downstream: ${serverName}`);
    return ds.client.readResource({ uri: originalUri });
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const prompts = [];
    for (const ds of downstreams) {
      try {
        const res = await ds.client.listPrompts();
        for (const p of res.prompts ?? []) {
          prompts.push({ ...p, name: `${ds.name}__${p.name}` });
        }
      } catch {
        // ignore
      }
    }
    return { prompts };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const name = request.params.name;
    const sep = name.indexOf("__");
    if (sep < 0) throw new Error(`Unknown prompt: ${name}`);
    const serverName = name.slice(0, sep);
    const original = name.slice(sep + 2);
    const ds = downstreams.find((d) => d.name === serverName);
    if (!ds) throw new Error(`Unknown downstream: ${serverName}`);
    return ds.client.getPrompt({
      name: original,
      arguments: request.params.arguments,
    });
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[sentinel] proxy ready — session ${sessionId}`);
  return server;
}

async function connectDownstream(
  name: string,
  cfg: DownstreamServerConfig
): Promise<Downstream> {
  const client = new Client({ name: `sentinel-to-${name}`, version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: cfg.command,
    args: cfg.args ?? [],
    env: cfg.env ? { ...process.env, ...cfg.env } as Record<string, string> : undefined,
    cwd: cfg.cwd,
  });
  await client.connect(transport);
  const listed = await client.listTools();
  return { name, client, tools: listed.tools as Tool[] };
}
