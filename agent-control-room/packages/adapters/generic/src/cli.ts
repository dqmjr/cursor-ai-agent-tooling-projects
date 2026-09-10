#!/usr/bin/env node
/**
 * Generic adapter: POST JSON / JSONL events to the ACR daemon.
 * Use this when you do not have a first-party hook — wrap any agent CLI
 * and emit standardized events.
 *
 *   echo '{"sessionId":"demo","type":"task_started","title":"Hi"}' | acr-ingest
 *   acr-ingest --file events.jsonl
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const program = new Command();

program
  .name("acr-ingest")
  .description("Ingest generic ACR events from stdin, file, or args")
  .option("--url <url>", "ACR daemon URL", process.env.ACR_URL ?? "http://127.0.0.1:3930")
  .option("-f, --file <path>", "JSON or JSONL file")
  .action(async (opts: { url: string; file?: string }) => {
    const url = opts.url.replace(/\/$/, "");
    if (opts.file) {
      const text = readFileSync(opts.file, "utf8").trim();
      if (text.startsWith("[")) {
        await post(url, { events: JSON.parse(text) });
        return;
      }
      if (text.startsWith("{") && !text.includes("\n{")) {
        await post(url, JSON.parse(text));
        return;
      }
      // JSONL
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        await post(url, JSON.parse(line));
      }
      return;
    }

    if (process.stdin.isTTY) {
      console.error("Pass --file or pipe JSON on stdin");
      process.exit(1);
    }

    const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
    const lines: string[] = [];
    for await (const line of rl) lines.push(line);
    const text = lines.join("\n").trim();
    if (!text) return;
    if (text.startsWith("[")) {
      await post(url, { events: JSON.parse(text) });
    } else if (text.includes("\n")) {
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        await post(url, JSON.parse(line));
      }
    } else {
      await post(url, JSON.parse(text));
    }
  });

await program.parseAsync(process.argv);

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(`${url}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(text);
    process.exitCode = 1;
    return;
  }
  console.log(text);
}
