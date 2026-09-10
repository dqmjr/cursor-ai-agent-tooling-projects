/**
 * Hash-chained, tamper-evident SQLite audit log.
 *
 * Each row stores sha256(prevHash + payload). The genesis prevHash is 64 zeros.
 * verifyChain() recomputes hashes and reports the first break.
 */

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { AuditRecord, ToolCallEvent } from "../types.js";

const GENESIS = "0".repeat(64);

export class AuditLog {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_hash TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        session_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        arguments_json TEXT NOT NULL,
        result_json TEXT,
        is_error INTEGER NOT NULL DEFAULT 0,
        policy_action TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_events(server_name, tool_name);
    `);
  }

  append(event: ToolCallEvent): AuditRecord {
    const prevHash = this.latestHash() ?? GENESIS;
    const argumentsJson = JSON.stringify(event.arguments ?? null);
    const resultJson =
      event.result === undefined ? null : JSON.stringify(event.result);

    const payload = [
      prevHash,
      event.sessionId,
      event.serverName,
      event.toolName,
      argumentsJson,
      resultJson ?? "",
      String(event.isError ? 1 : 0),
      event.policyAction,
      String(event.durationMs),
      event.createdAt,
    ].join("|");

    const chainHash = sha256(payload);

    const info = this.db
      .prepare(
        `INSERT INTO audit_events
          (chain_hash, prev_hash, session_id, server_name, tool_name,
           arguments_json, result_json, is_error, policy_action, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chainHash,
        prevHash,
        event.sessionId,
        event.serverName,
        event.toolName,
        argumentsJson,
        resultJson,
        event.isError ? 1 : 0,
        event.policyAction,
        event.durationMs,
        event.createdAt
      );

    return {
      id: Number(info.lastInsertRowid),
      chainHash,
      prevHash,
      sessionId: event.sessionId,
      serverName: event.serverName,
      toolName: event.toolName,
      argumentsJson,
      resultJson,
      isError: event.isError ? 1 : 0,
      policyAction: event.policyAction,
      durationMs: event.durationMs,
      createdAt: event.createdAt,
    };
  }

  latestHash(): string | null {
    const row = this.db
      .prepare(`SELECT chain_hash FROM audit_events ORDER BY id DESC LIMIT 1`)
      .get() as { chain_hash: string } | undefined;
    return row?.chain_hash ?? null;
  }

  list(opts: {
    sessionId?: string;
    limit?: number;
    offset?: number;
  } = {}): AuditRecord[] {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    if (opts.sessionId) {
      return (
        this.db
          .prepare(
            `SELECT id, chain_hash AS chainHash, prev_hash AS prevHash,
                    session_id AS sessionId, server_name AS serverName,
                    tool_name AS toolName, arguments_json AS argumentsJson,
                    result_json AS resultJson, is_error AS isError,
                    policy_action AS policyAction, duration_ms AS durationMs,
                    created_at AS createdAt
             FROM audit_events
             WHERE session_id = ?
             ORDER BY id DESC LIMIT ? OFFSET ?`
          )
          .all(opts.sessionId, limit, offset) as AuditRecord[]
      );
    }
    return this.db
      .prepare(
        `SELECT id, chain_hash AS chainHash, prev_hash AS prevHash,
                session_id AS sessionId, server_name AS serverName,
                tool_name AS toolName, arguments_json AS argumentsJson,
                result_json AS resultJson, is_error AS isError,
                policy_action AS policyAction, duration_ms AS durationMs,
                created_at AS createdAt
         FROM audit_events
         ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as AuditRecord[];
  }

  get(id: number): AuditRecord | undefined {
    return this.db
      .prepare(
        `SELECT id, chain_hash AS chainHash, prev_hash AS prevHash,
                session_id AS sessionId, server_name AS serverName,
                tool_name AS toolName, arguments_json AS argumentsJson,
                result_json AS resultJson, is_error AS isError,
                policy_action AS policyAction, duration_ms AS durationMs,
                created_at AS createdAt
         FROM audit_events WHERE id = ?`
      )
      .get(id) as AuditRecord | undefined;
  }

  sessions(): Array<{ sessionId: string; count: number; lastAt: string }> {
    return this.db
      .prepare(
        `SELECT session_id AS sessionId, COUNT(*) AS count,
                MAX(created_at) AS lastAt
         FROM audit_events
         GROUP BY session_id
         ORDER BY lastAt DESC`
      )
      .all() as Array<{ sessionId: string; count: number; lastAt: string }>;
  }

  stats(): {
    total: number;
    errors: number;
    denied: number;
    avgDurationMs: number;
  } {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) AS errors,
           SUM(CASE WHEN policy_action = 'deny' THEN 1 ELSE 0 END) AS denied,
           AVG(duration_ms) AS avgDurationMs
         FROM audit_events`
      )
      .get() as {
      total: number;
      errors: number;
      denied: number;
      avgDurationMs: number | null;
    };
    return {
      total: row.total ?? 0,
      errors: row.errors ?? 0,
      denied: row.denied ?? 0,
      avgDurationMs: Math.round(row.avgDurationMs ?? 0),
    };
  }

  /**
   * Recompute the hash chain. Returns ok=true if intact.
   */
  verifyChain(): { ok: boolean; checked: number; brokenAtId?: number; detail?: string } {
    const rows = this.db
      .prepare(
        `SELECT id, chain_hash, prev_hash, session_id, server_name, tool_name,
                arguments_json, result_json, is_error, policy_action,
                duration_ms, created_at
         FROM audit_events ORDER BY id ASC`
      )
      .all() as Array<{
      id: number;
      chain_hash: string;
      prev_hash: string;
      session_id: string;
      server_name: string;
      tool_name: string;
      arguments_json: string;
      result_json: string | null;
      is_error: number;
      policy_action: string;
      duration_ms: number;
      created_at: string;
    }>;

    let expectedPrev = GENESIS;
    for (const row of rows) {
      if (row.prev_hash !== expectedPrev) {
        return {
          ok: false,
          checked: row.id - 1,
          brokenAtId: row.id,
          detail: `prev_hash mismatch at id=${row.id}`,
        };
      }
      const payload = [
        row.prev_hash,
        row.session_id,
        row.server_name,
        row.tool_name,
        row.arguments_json,
        row.result_json ?? "",
        String(row.is_error),
        row.policy_action,
        String(row.duration_ms),
        row.created_at,
      ].join("|");
      const expected = sha256(payload);
      if (expected !== row.chain_hash) {
        return {
          ok: false,
          checked: row.id - 1,
          brokenAtId: row.id,
          detail: `chain_hash mismatch at id=${row.id}`,
        };
      }
      expectedPrev = row.chain_hash;
    }
    return { ok: true, checked: rows.length };
  }

  close(): void {
    this.db.close();
  }
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
