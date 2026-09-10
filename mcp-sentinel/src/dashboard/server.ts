/**
 * Local HTTP API + static dashboard for browsing the audit log.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditLog } from "../audit/log.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export interface DashboardOptions {
  audit: AuditLog;
  port: number;
  /** Directory containing built dashboard assets (index.html, assets/). */
  staticDir?: string;
}

export function startDashboard(opts: DashboardOptions): ReturnType<typeof createServer> {
  const staticDir =
    opts.staticDir ??
    resolve(fileURLToPath(new URL("../../dashboard/dist", import.meta.url)));

  const server = createServer(async (req, res) => {
    try {
      await handle(req, res, opts.audit, staticDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      json(res, 500, { error: message });
    }
  });

  server.listen(opts.port, "127.0.0.1", () => {
    console.error(`[sentinel] dashboard http://127.0.0.1:${opts.port}`);
  });
  return server;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  audit: AuditLog,
  staticDir: string
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (path === "/api/health") {
    return json(res, 200, { ok: true, name: "mcp-sentinel" });
  }
  if (path === "/api/stats") {
    return json(res, 200, audit.stats());
  }
  if (path === "/api/sessions") {
    return json(res, 200, audit.sessions());
  }
  if (path === "/api/events") {
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "100");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    return json(res, 200, audit.list({ sessionId, limit, offset }));
  }
  if (path.startsWith("/api/events/")) {
    const id = Number(path.slice("/api/events/".length));
    const row = audit.get(id);
    if (!row) return json(res, 404, { error: "not found" });
    return json(res, 200, row);
  }
  if (path === "/api/verify") {
    return json(res, 200, audit.verifyChain());
  }

  // Static files
  let filePath = join(staticDir, path === "/" ? "index.html" : path);
  if (!filePath.startsWith(staticDir)) {
    return json(res, 403, { error: "forbidden" });
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = join(staticDir, "index.html");
  }
  if (!existsSync(filePath)) {
    return json(res, 404, {
      error: "Dashboard not built. Run: npm run build:dashboard",
    });
  }
  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(readFileSync(filePath));
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}
