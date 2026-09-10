/**
 * Markdown link checker — verifies local relative links resolve.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { VerifierPack, VerifyFinding, VerifyResult } from "../types.js";

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export const markdownLinksPack: VerifierPack = {
  name: "markdown-links",
  description: "Check that relative markdown links point at existing files",
  verify(ctx): VerifyResult {
    const filePath = resolve(ctx.cwd ?? process.cwd(), ctx.path);
    const content = ctx.content ?? readFileSync(filePath, "utf8");
    const baseDir = dirname(filePath);
    const findings: VerifyFinding[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(LINK_RE.source, "g");

    while ((match = re.exec(content)) !== null) {
      const href = match[2].trim();
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("#") ||
        href.startsWith("data:")
      ) {
        continue;
      }
      const clean = href.split("#")[0].split("?")[0];
      if (!clean) continue;
      const target = resolve(baseDir, clean);
      if (!existsSync(target)) {
        const line = content.slice(0, match.index).split(/\r?\n/).length;
        findings.push({
          severity: "error",
          message: `Broken relative link: ${href}`,
          path: filePath,
          line,
        });
      }
    }

    const pass = findings.filter((f) => f.severity === "error").length === 0;
    return {
      pack: this.name,
      pass,
      findings,
      summary: pass
        ? `All relative links OK in ${ctx.path}`
        : `${findings.length} broken link(s) in ${ctx.path}`,
    };
  },
};
