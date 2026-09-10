/**
 * Secrets scanner — heuristic regexes for common credential patterns.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import type { VerifierPack, VerifyFinding, VerifyResult } from "../types.js";

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "Generic API key assignment", re: /(?:api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]/gi },
  { name: "Private key header", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml",
  ".env", ".txt", ".toml", ".ini", ".cfg", ".py", ".rb", ".go", ".rs", ".java",
  ".sh", ".bash", ".zsh", ".ps1", ".html", ".css", ".scss",
]);

export const secretsPack: VerifierPack = {
  name: "secrets",
  description: "Scan a file or directory for common secret patterns",
  verify(ctx): VerifyResult {
    const root = resolve(ctx.cwd ?? process.cwd(), ctx.path);
    const findings: VerifyFinding[] = [];

    if (ctx.content !== undefined) {
      scanText(ctx.path, ctx.content, findings);
    } else {
      walk(root, (file, text) => scanText(file, text, findings));
    }

    const pass = findings.filter((f) => f.severity === "error").length === 0;
    return {
      pack: this.name,
      pass,
      findings,
      summary: pass
        ? `No secrets detected in ${ctx.path}`
        : `${findings.length} potential secret(s) in ${ctx.path}`,
    };
  },
};

function scanText(path: string, text: string, findings: VerifyFinding[]): void {
  for (const pattern of PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      findings.push({
        severity: "error",
        message: `Possible ${pattern.name}`,
        path,
        line,
      });
    }
  }
}

function walk(path: string, visit: (file: string, text: string) => void): void {
  const st = statSync(path);
  if (st.isFile()) {
    if (shouldRead(path)) {
      visit(path, readFileSync(path, "utf8"));
    }
    return;
  }
  if (!st.isDirectory()) return;
  for (const name of readdirSync(path)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === "coverage") {
      continue;
    }
    walk(join(path, name), visit);
  }
}

function shouldRead(file: string): boolean {
  const base = file.split(/[/\\]/).pop() ?? file;
  if (base.startsWith(".env")) return true;
  return TEXT_EXTS.has(extname(file).toLowerCase());
}
