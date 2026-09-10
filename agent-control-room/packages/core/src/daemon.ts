/**
 * Fastify HTTP + WebSocket daemon for Agent Control Room.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { resolve } from "node:path";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.js";
import {
  AgentEventSchema,
  ApprovalDecisionSchema,
  IngestPayloadSchema,
  type AgentEvent,
} from "./schema.js";
import { gitDiff, gitRollback } from "./git.js";

export interface DaemonOptions {
  port?: number;
  host?: string;
  dbPath?: string;
  staticDir?: string;
}

type WsClient = { send: (data: string) => void };

export async function startDaemon(opts: DaemonOptions = {}) {
  const port = opts.port ?? 3930;
  const host = opts.host ?? "127.0.0.1";
  const dbPath = opts.dbPath ?? resolve(".acr/control-room.db");
  const store = new Store(dbPath);
  const clients = new Set<WsClient>();

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const broadcast = (payload: unknown) => {
    const data = JSON.stringify(payload);
    for (const c of clients) {
      try {
        c.send(data);
      } catch {
        clients.delete(c);
      }
    }
  };

  const ingestOne = (raw: AgentEvent) => {
    const parsed = AgentEventSchema.parse(raw);
    const result = store.ingest(parsed);
    broadcast({ type: "event", ...result });
    return result;
  };

  app.get("/api/health", async () => ({
    ok: true,
    name: "agent-control-room",
    version: "0.1.0",
  }));

  app.get("/api/sessions", async () => store.listSessions());

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (req, reply) => {
    const session = store.getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: "not found" });
    return session;
  });

  app.get<{ Querystring: { sessionId?: string; limit?: string } }>(
    "/api/events",
    async (req) => {
      const limit = req.query.limit ? Number(req.query.limit) : 200;
      return store.listEvents(req.query.sessionId, limit);
    }
  );

  app.post("/api/events", async (req, reply) => {
    const body = IngestPayloadSchema.parse(req.body);
    if ("events" in body) {
      const results = body.events.map((e) => ingestOne(e));
      return { ok: true, count: results.length, results };
    }
    return { ok: true, ...ingestOne(body) };
  });

  app.post("/api/approve", async (req, reply) => {
    const body = ApprovalDecisionSchema.parse(req.body);
    const session = store.getSession(body.sessionId);
    if (!session) return reply.code(404).send({ error: "session not found" });

    if (body.decision === "approve") {
      const updated = store.setStatus(body.sessionId, "running", body.note ?? "Approved");
      ingestOne({
        sessionId: body.sessionId,
        source: session.source as AgentEvent["source"],
        type: "approved",
        message: body.note ?? "Approved by human",
      });
      broadcast({ type: "approval", session: updated, decision: "approve" });
      return { ok: true, session: updated };
    }

    const updated = store.setStatus(body.sessionId, "failed", body.note ?? "Rejected");
    ingestOne({
      sessionId: body.sessionId,
      source: session.source as AgentEvent["source"],
      type: "rejected",
      message: body.note ?? "Rejected by human",
    });
    broadcast({ type: "approval", session: updated, decision: "reject" });
    return { ok: true, session: updated };
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/diff", async (req, reply) => {
    const session = store.getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (!session.cwd) return reply.code(400).send({ error: "session has no cwd" });
    const diff = gitDiff(session.cwd, session.baseCommit);
    return { sessionId: session.id, baseCommit: session.baseCommit, diff };
  });

  app.post<{ Params: { id: string } }>("/api/sessions/:id/rollback", async (req, reply) => {
    const session = store.getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (!session.cwd || !session.baseCommit) {
      return reply
        .code(400)
        .send({ error: "session needs cwd and baseCommit for rollback" });
    }
    const result = gitRollback(session.cwd, session.baseCommit);
    if (!result.ok) return reply.code(500).send(result);
    const updated = store.setStatus(session.id, "rolled_back", result.output);
    ingestOne({
      sessionId: session.id,
      source: session.source as AgentEvent["source"],
      type: "rolled_back",
      message: `Rolled back to ${session.baseCommit}`,
      metadata: { output: result.output },
    });
    broadcast({ type: "rollback", session: updated });
    return { ok: true, session: updated, output: result.output };
  });

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "hello", sessions: store.listSessions() }));
    socket.on("close", () => clients.delete(socket));
  });

  // Static dashboard (optional)
  const staticDir =
    opts.staticDir ??
    resolve(fileURLToPath(new URL("../../../web/dist", import.meta.url)));

  const MIME: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };

  app.get("/*", async (req, reply) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/ws")) return;
    let filePath = join(staticDir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
    if (!filePath.startsWith(staticDir)) {
      return reply.code(403).send("forbidden");
    }
    if (!existsSync(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
      filePath = join(staticDir, "index.html");
    }
    if (!existsSync(filePath)) {
      return reply
        .code(404)
        .type("application/json")
        .send({ error: "Dashboard not built. Run: npm run build -w @acr/web" });
    }
    const ext = extname(filePath);
    return reply.type(MIME[ext] ?? "application/octet-stream").send(readFileSync(filePath));
  });

  await app.listen({ port, host });
  console.error(`[acr] daemon http://${host}:${port}`);
  console.error(`[acr] db ${dbPath}`);

  return { app, store, broadcast, ingestOne };
}
