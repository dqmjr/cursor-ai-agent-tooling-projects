#!/usr/bin/env node
/**
 * Agent Control Room CLI
 *
 *   acr daemon [--port 3930] [--db .acr/control-room.db]
 *   acr ingest --file event.json
 *   acr sessions
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startDaemon } from "./daemon.js";
import { Store } from "./store.js";
import { AgentEventSchema, IngestPayloadSchema } from "./schema.js";

const program = new Command();

program
  .name("acr")
  .description("Agent Control Room — multi-agent session dashboard daemon")
  .version("0.1.0");

program
  .command("daemon")
  .description("Start the local HTTP + WebSocket daemon")
  .option("-p, --port <number>", "Listen port", "3930")
  .option("--host <host>", "Bind address", "127.0.0.1")
  .option("--db <path>", "SQLite path", ".acr/control-room.db")
  .option("--static <dir>", "Dashboard static assets directory")
  .action(async (opts: { port: string; host: string; db: string; static?: string }) => {
    await startDaemon({
      port: Number(opts.port),
      host: opts.host,
      dbPath: resolve(opts.db),
      staticDir: opts.static ? resolve(opts.static) : undefined,
    });
  });

program
  .command("ingest")
  .description("POST an event JSON file to a running daemon")
  .requiredOption("-f, --file <path>", "JSON file with one event or { events: [...] }")
  .option("--url <url>", "Daemon base URL", "http://127.0.0.1:3930")
  .action(async (opts: { file: string; url: string }) => {
    const raw = JSON.parse(readFileSync(opts.file, "utf8"));
    const body = IngestPayloadSchema.parse(raw);
    const res = await fetch(`${opts.url.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(text);
      process.exit(1);
    }
    console.log(text);
  });

program
  .command("sessions")
  .description("List sessions from a local db (no daemon required)")
  .option("--db <path>", "SQLite path", ".acr/control-room.db")
  .action((opts: { db: string }) => {
    const store = new Store(resolve(opts.db));
    console.log(JSON.stringify(store.listSessions(), null, 2));
    store.close();
  });

program
  .command("emit")
  .description("Emit a single event via HTTP (quick adapter helper)")
  .requiredOption("--session <id>", "Session id")
  .requiredOption("--type <type>", "Event type")
  .option("--source <source>", "Agent source", "generic")
  .option("--title <title>", "Title")
  .option("--message <message>", "Message")
  .option("--cwd <cwd>", "Working directory")
  .option("--base-commit <sha>", "Git base commit for rollback")
  .option("--url <url>", "Daemon base URL", "http://127.0.0.1:3930")
  .action(async (opts: Record<string, string>) => {
    const event = AgentEventSchema.parse({
      sessionId: opts.session,
      type: opts.type,
      source: opts.source,
      title: opts.title,
      message: opts.message,
      cwd: opts.cwd,
      baseCommit: opts.baseCommit,
    });
    const res = await fetch(`${opts.url.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    console.log(await res.text());
    if (!res.ok) process.exit(1);
  });

await program.parseAsync(process.argv);
