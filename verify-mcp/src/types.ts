/**
 * Verifier pack contract.
 */

export interface VerifyFinding {
  severity: "error" | "warn" | "info";
  message: string;
  path?: string;
  line?: number;
  details?: unknown;
}

export interface VerifyResult {
  pack: string;
  pass: boolean;
  findings: VerifyFinding[];
  summary: string;
}

export interface VerifyContext {
  /** Absolute or relative path to the artifact (file or directory). */
  path: string;
  /** Optional inline content (skips reading from disk when set). */
  content?: string;
  /** Pack-specific options. */
  options?: Record<string, unknown>;
  /** Working directory for relative paths. */
  cwd?: string;
}

export interface VerifierPack {
  name: string;
  description: string;
  verify(ctx: VerifyContext): Promise<VerifyResult> | VerifyResult;
}
