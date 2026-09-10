/**
 * Shared event schema for Agent Control Room.
 * Adapters emit these events; the daemon stores and broadcasts them.
 */

import { z } from "zod";

export const AgentSourceSchema = z.enum([
  "claude-code",
  "cursor",
  "codex",
  "generic",
  "manual",
]);
export type AgentSource = z.infer<typeof AgentSourceSchema>;

export const SessionStatusSchema = z.enum([
  "running",
  "waiting_approval",
  "blocked",
  "completed",
  "failed",
  "rolled_back",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const EventTypeSchema = z.enum([
  "task_started",
  "task_progress",
  "tool_call",
  "file_changed",
  "waiting_for_approval",
  "approved",
  "rejected",
  "completed",
  "failed",
  "rolled_back",
  "note",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const FileChangeSchema = z.object({
  path: z.string(),
  kind: z.enum(["created", "modified", "deleted", "renamed"]),
  /** Unified diff snippet when available. */
  diff: z.string().optional(),
  beforeHash: z.string().optional(),
  afterHash: z.string().optional(),
});
export type FileChange = z.infer<typeof FileChangeSchema>;

export const AgentEventSchema = z.object({
  /** Optional client-supplied id; daemon assigns one if missing. */
  id: z.string().optional(),
  /** Session this event belongs to. Created on first sight. */
  sessionId: z.string().min(1),
  source: AgentSourceSchema.default("generic"),
  type: EventTypeSchema,
  title: z.string().optional(),
  message: z.string().optional(),
  toolName: z.string().optional(),
  toolArgs: z.unknown().optional(),
  files: z.array(FileChangeSchema).optional(),
  /** Working directory / repo root for rollback. */
  cwd: z.string().optional(),
  /** Git commit SHA before the agent started mutating files (for rollback). */
  baseCommit: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const IngestPayloadSchema = z.union([
  AgentEventSchema,
  z.object({ events: z.array(AgentEventSchema).min(1) }),
]);

export const ApprovalDecisionSchema = z.object({
  sessionId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
