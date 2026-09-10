#!/usr/bin/env node
/**
 * Cursor adapter for Agent Control Room.
 *
 * Two modes:
 * 1) Hook command (stdin JSON) — for Cursor hooks when available:
 *      acr-cursor-hook --phase tool
 * 2) JSONL tail — watch a log file Cursor (or a wrapper) writes:
 *      acr-cursor-hook tail --file .cursor/agent-events.jsonl
 *
 * Example Cursor hooks.json entry (project or user):
 * {
 *   "hooks": {
 *     "preToolUse": [{ "command": "acr-cursor-hook --phase pre" }],
 *     "postToolUse": [{ "command": "acr-cursor-hook --phase post" }]
 *   }
 * }
 */

import { Command } from "commander";
import { createReadStream, existsSync, watchFile } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const program = new Command();

program
  .name("acr-cursor-hook")
  .description("Forward Cursor agent events to Agent Control Room")
  .option("--phase <phase>", "Hook phase: pre | post | start | stop | tool", "post")
  .option("--url <url>", "ACR daemon URL", process.env.ACR_URL ?? "http://127.0.0.1:3930")
  .option("--session <id>", "Override session id", process.env.ACR_SESSION)
  .action(async (opts: { phase: string; url: string; session?: string }) => {
    const raw = await readStdin();
    let payload: Record<string, unknown> = {};
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        payload = { raw };
      }
    }
    await postEvent(opts.url, mapCursor(opts.phase, payload, opts.session));
  });

program
  .command("tail")
  .description("Tail a JSONL event file and forward lines to ACR")
  .requiredOption("-f, --file <path>", "JSONL file path")
  .option("--url <url>", "ACR daemon URL", process.env.ACR_URL ?? "http://127.0.0.1:3930")
  .action(async (opts: { file: string; url: string }) => {
    const file = resolve(opts.file);
    console.error(`[acr-cursor] tailing ${file}`);
    let offset = 0;

    const pump = async () => {
      if (!existsSync(file)) return;
      const stream = createReadStream(file, { start: offset, encoding: "utf8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      for await (const line of rl) {
        offset += Buffer.byteLength(line, "utf8") + 1;
        if (!line.trim()) continue;
        try {
          const payload = JSON.parse(line) as Record<string, unknown>;
          const phase = String(payload.phase ?? payload.type ?? "tool");
          await postEvent(opts.url, mapCursor(phase, payload, payload.sessionId as string | undefined));
        } catch (err) {
          console.error(`[acr-cursor] skip line: ${err}`);
        }
      }
    };

    await pump();
    watchFile(file, { interval: 500 }, () => {
      void pump();
    });
  });

await program.parseAsync(process.argv);

function mapCursor(
  phase: string,
  payload: Record<string, unknown>,
  sessionOverride?: string
) {
  const cwd =
    (payload.cwd as string | undefined) ||
    (payload.workspaceRoot as string | undefined) ||
    process.cwd();
  const sessionId =
    sessionOverride ||
    (payload.sessionId as string | undefined) ||
    (payload.conversationId as string | undefined) ||
    `cursor-${hash(cwd)}`;
  const toolName =
    (payload.toolName as string | undefined) ||
    (payload.tool_name as string | undefined) ||
    (payload.name as string | undefined);

  const base = {
    sessionId,
    source: "cursor" as const,
    cwd,
    metadata: { phase, hook: payload },
  };

  const normalized = phase.toLowerCase();
  if (normalized === "start" || normalized === "task_started") {
    return { ...base, type: "task_started", title: "Cursor agent", message: "Session started" };
  }
  if (normalized === "stop" || normalized === "completed") {
    return { ...base, type: "completed", message: "Cursor agent completed" };
  }
  if (normalized === "pre" || normalized === "pretooluse" || normalized === "waiting_for_approval") {
    return {
      ...base,
      type: "waiting_for_approval",
      toolName,
      title: toolName ? `Approve ${toolName}` : "Waiting for approval",
      message: `Cursor pre-tool: ${toolName ?? "tool"}`,
      toolArgs: payload.args ?? payload.arguments ?? payload,
      files: Array.isArray(payload.files) ? payload.files : undefined,
    };
  }
  if (normalized === "file" || normalized === "file_changed") {
    return {
      ...base,
      type: "file_changed",
      message: "Files changed",
      files: Array.isArray(payload.files) ? payload.files : undefined,
    };
  }
  return {
    ...base,
    type: "tool_call",
    toolName,
    message: `Cursor tool: ${toolName ?? "tool"}`,
    toolArgs: payload.args ?? payload.arguments ?? payload,
  };
}

async function postEvent(url: string, event: unknown): Promise<void> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.error(`[acr-cursor] ingest failed: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[acr-cursor] ${err}`);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(Buffer.from(c)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    setTimeout(() => resolve(Buffer.concat(chunks).toString("utf8")), 200);
  });
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
