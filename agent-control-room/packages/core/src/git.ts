/**
 * Git helpers for one-click rollback to a session's base commit.
 */

import { execFileSync } from "node:child_process";

export function gitHead(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

export function gitDiff(cwd: string, baseCommit?: string | null): string {
  try {
    if (baseCommit) {
      return execFileSync("git", ["diff", baseCommit], {
        cwd,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    }
    return execFileSync("git", ["diff"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Hard reset working tree to baseCommit. Destructive — intended for local agent sandboxes.
 */
export function gitRollback(cwd: string, baseCommit: string): { ok: boolean; output: string } {
  try {
    const output = execFileSync("git", ["reset", "--hard", baseCommit], {
      cwd,
      encoding: "utf8",
    });
    // Also drop untracked files created by the agent.
    const clean = execFileSync("git", ["clean", "-fd"], {
      cwd,
      encoding: "utf8",
    });
    return { ok: true, output: `${output}\n${clean}`.trim() };
  } catch (err) {
    return {
      ok: false,
      output: err instanceof Error ? err.message : String(err),
    };
  }
}
