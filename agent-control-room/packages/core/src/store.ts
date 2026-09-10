/**
 * SQLite persistence for sessions and events.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { AgentEvent, SessionStatus } from "./schema.js";

export interface SessionRow {
  id: string;
  source: string;
  status: SessionStatus;
  title: string | null;
  cwd: string | null;
  baseCommit: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventRow {
  id: string;
  sessionId: string;
  source: string;
  type: string;
  title: string | null;
  message: string | null;
  toolName: string | null;
  toolArgsJson: string | null;
  filesJson: string | null;
  metadataJson: string | null;
  createdAt: string;
}

export class Store {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT,
        cwd TEXT,
        base_commit TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        message TEXT,
        tool_name TEXT,
        tool_args_json TEXT,
        files_json TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
    `);
  }

  ingest(event: AgentEvent): { session: SessionRow; event: EventRow } {
    const now = event.createdAt ?? new Date().toISOString();
    const eventId = event.id ?? randomUUID();

    let session = this.getSession(event.sessionId);
    if (!session) {
      const status = statusFromEventType(event.type);
      this.db
        .prepare(
          `INSERT INTO sessions (id, source, status, title, cwd, base_commit, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          event.sessionId,
          event.source ?? "generic",
          status,
          event.title ?? event.message ?? null,
          event.cwd ?? null,
          event.baseCommit ?? null,
          now,
          now
        );
      session = this.getSession(event.sessionId)!;
    } else {
      const nextStatus = statusFromEventType(event.type);
      const title = event.title ?? session.title;
      const cwd = event.cwd ?? session.cwd;
      const baseCommit = event.baseCommit ?? session.baseCommit;
      this.db
        .prepare(
          `UPDATE sessions SET status = ?, title = ?, cwd = ?, base_commit = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(nextStatus, title, cwd, baseCommit, now, event.sessionId);
      session = this.getSession(event.sessionId)!;
    }

    this.db
      .prepare(
        `INSERT INTO events
          (id, session_id, source, type, title, message, tool_name, tool_args_json, files_json, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        eventId,
        event.sessionId,
        event.source ?? "generic",
        event.type,
        event.title ?? null,
        event.message ?? null,
        event.toolName ?? null,
        event.toolArgs !== undefined ? JSON.stringify(event.toolArgs) : null,
        event.files ? JSON.stringify(event.files) : null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        now
      );

    return { session, event: this.getEvent(eventId)! };
  }

  setStatus(sessionId: string, status: SessionStatus, note?: string): SessionRow | undefined {
    const session = this.getSession(sessionId);
    if (!session) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, now, sessionId);
    if (note) {
      this.ingest({
        sessionId,
        source: session.source as AgentEvent["source"],
        type: status === "rolled_back" ? "rolled_back" : status === "completed" ? "approved" : "note",
        message: note,
        createdAt: now,
      });
    }
    return this.getSession(sessionId);
  }

  getSession(id: string): SessionRow | undefined {
    return this.db
      .prepare(
        `SELECT id, source, status, title, cwd, base_commit AS baseCommit,
                created_at AS createdAt, updated_at AS updatedAt
         FROM sessions WHERE id = ?`
      )
      .get(id) as SessionRow | undefined;
  }

  listSessions(limit = 100): SessionRow[] {
    return this.db
      .prepare(
        `SELECT id, source, status, title, cwd, base_commit AS baseCommit,
                created_at AS createdAt, updated_at AS updatedAt
         FROM sessions ORDER BY updated_at DESC LIMIT ?`
      )
      .all(limit) as SessionRow[];
  }

  getEvent(id: string): EventRow | undefined {
    return this.db
      .prepare(
        `SELECT id, session_id AS sessionId, source, type, title, message,
                tool_name AS toolName, tool_args_json AS toolArgsJson,
                files_json AS filesJson, metadata_json AS metadataJson,
                created_at AS createdAt
         FROM events WHERE id = ?`
      )
      .get(id) as EventRow | undefined;
  }

  listEvents(sessionId?: string, limit = 200): EventRow[] {
    if (sessionId) {
      return this.db
        .prepare(
          `SELECT id, session_id AS sessionId, source, type, title, message,
                  tool_name AS toolName, tool_args_json AS toolArgsJson,
                  files_json AS filesJson, metadata_json AS metadataJson,
                  created_at AS createdAt
           FROM events WHERE session_id = ?
           ORDER BY created_at DESC LIMIT ?`
        )
        .all(sessionId, limit) as EventRow[];
    }
    return this.db
      .prepare(
        `SELECT id, session_id AS sessionId, source, type, title, message,
                tool_name AS toolName, tool_args_json AS toolArgsJson,
                files_json AS filesJson, metadata_json AS metadataJson,
                created_at AS createdAt
         FROM events ORDER BY created_at DESC LIMIT ?`
      )
      .all(limit) as EventRow[];
  }

  close(): void {
    this.db.close();
  }
}

function statusFromEventType(type: string): SessionStatus {
  switch (type) {
    case "waiting_for_approval":
      return "waiting_approval";
    case "approved":
      return "running";
    case "rejected":
    case "failed":
      return "failed";
    case "completed":
      return "completed";
    case "rolled_back":
      return "rolled_back";
    case "task_started":
    case "task_progress":
    case "tool_call":
    case "file_changed":
    case "note":
    default:
      return "running";
  }
}
