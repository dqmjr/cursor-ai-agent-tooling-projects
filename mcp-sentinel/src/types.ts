/**
 * Shared types for mcp-sentinel.
 */

export interface DownstreamServerConfig {
  /** Command to spawn (e.g. "npx", "node", "python"). */
  command: string;
  /** Arguments passed to the command. */
  args?: string[];
  /** Extra environment variables for the child process. */
  env?: Record<string, string>;
  /** Working directory for the child process. */
  cwd?: string;
}

/**
 * Config shape compatible with Cursor/Claude `mcp.json` mcpServers map,
 * plus optional sentinel-specific fields.
 */
export interface SentinelConfig {
  /** Downstream MCP servers keyed by short name. */
  mcpServers: Record<string, DownstreamServerConfig>;
  /** Path to policy YAML (relative to config file or absolute). */
  policyFile?: string;
  /** Path to SQLite audit database. */
  auditDb?: string;
  /** Dashboard listen port when running `mcp-sentinel dashboard`. */
  dashboardPort?: number;
  /** Session identifier written into every audit row. */
  sessionId?: string;
}

export type PolicyAction = "allow" | "deny" | "confirm";

export interface PolicyRule {
  /** Glob-style match against server/tool names using * and ? wildcards. */
  match: string;
  action: PolicyAction;
  /** Optional reason shown when denying / requiring confirmation. */
  reason?: string;
  /** Argument key patterns to redact from audit logs (substring match on JSON). */
  redactArgs?: string[];
}

export interface PolicyDocument {
  /** Default action when no rule matches. */
  defaultAction?: PolicyAction;
  /** Patterns always redacted from logged arguments / results. */
  redactPatterns?: string[];
  rules: PolicyRule[];
}

export interface AuditRecord {
  id: number;
  chainHash: string;
  prevHash: string;
  sessionId: string;
  serverName: string;
  toolName: string;
  argumentsJson: string;
  resultJson: string | null;
  isError: number;
  policyAction: string;
  durationMs: number;
  createdAt: string;
}

export interface ToolCallEvent {
  sessionId: string;
  serverName: string;
  toolName: string;
  arguments: unknown;
  result?: unknown;
  isError?: boolean;
  policyAction: PolicyAction;
  durationMs: number;
  createdAt: string;
}
