#!/usr/bin/env node
/**
 * Claude Code hook entrypoint.
 *
 * Wire in ~/.claude/settings.json (or project settings):
 *
 * {
 *   "hooks": {
 *     "PreToolUse": [{ "hooks": [{ "type": "command", "command": "acr-claude-hook --phase pre" }] }],
 *     "PostToolUse": [{ "hooks": [{ "type": "command", "command": "acr-claude-hook --phase post" }] }],
 *     "Stop": [{ "hooks": [{ "type": "command", "command": "acr-claude-hook --phase stop" }] }]
 *   }
 * }
 *
 * Claude Code posts a JSON payload on stdin for each hook invocation.
 * We map it to an ACR event and POST to the local daemon.
 */

import { Command } from "commander";

const program = new Command();

program
  .name("acr-claude-hook")
  .description("Forward Claude Code hook events to Agent Control Room")
  .option("--phase <phase>", "Hook phase: pre | post | stop | start", "post")
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

    const cwd =
      (payload.cwd as string | undefined) ||
      (payload.cwdPath as string | undefined) ||
      process.cwd();
    const sessionId =
      opts.session ||
      (payload.session_id as string | undefined) ||
      (payload.sessionId as string | undefined) ||
      `claude-${hashCwd(cwd)}`;

    const toolName =
      (payload.tool_name as string | undefined) ||
      (payload.toolName as string | undefined) ||
      (payload.tool as string | undefined);

    const event = mapPhase(opts.phase, {
      sessionId,
      cwd,
      toolName,
      payload,
    });

    const res = await fetch(`${opts.url.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[acr-claude-hook] ingest failed: ${text}`);
      // Non-zero exit can block the agent depending on hook config; stay soft.
      process.exit(0);
    }
  });

await program.parseAsync(process.argv);

function mapPhase(
  phase: string,
  ctx: {
    sessionId: string;
    cwd: string;
    toolName?: string;
    payload: Record<string, unknown>;
  }
) {
  const base = {
    sessionId: ctx.sessionId,
    source: "claude-code" as const,
    cwd: ctx.cwd,
    metadata: { phase, hook: ctx.payload },
  };

  if (phase === "start") {
    return {
      ...base,
      type: "task_started",
      title: "Claude Code session",
      message: "Session started",
    };
  }
  if (phase === "stop") {
    return {
      ...base,
      type: "completed",
      message: "Claude Code stopped",
    };
  }
  if (phase === "pre") {
    return {
      ...base,
      type: "waiting_for_approval",
      toolName: ctx.toolName,
      title: ctx.toolName ? `Approve ${ctx.toolName}` : "Waiting for approval",
      message: `PreToolUse: ${ctx.toolName ?? "tool"}`,
      toolArgs: ctx.payload.tool_input ?? ctx.payload.input ?? ctx.payload,
    };
  }
  // post
  return {
    ...base,
    type: "tool_call",
    toolName: ctx.toolName,
    message: `PostToolUse: ${ctx.toolName ?? "tool"}`,
    toolArgs: ctx.payload.tool_input ?? ctx.payload.input ?? ctx.payload,
  };
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
    // Safety timeout for hosts that never close stdin
    setTimeout(() => resolve(Buffer.concat(chunks).toString("utf8")), 200);
  });
}

function hashCwd(cwd: string): string {
  let h = 0;
  for (let i = 0; i < cwd.length; i++) h = (h * 31 + cwd.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
