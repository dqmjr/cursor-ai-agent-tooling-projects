/**
 * YAML policy engine: allow / deny / confirm + argument redaction.
 */

import { readFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import type { PolicyAction, PolicyDocument, PolicyRule } from "../types.js";

const EMPTY_POLICY: PolicyDocument = {
  defaultAction: "allow",
  redactPatterns: ["password", "secret", "token", "apiKey", "api_key", "authorization"],
  rules: [],
};

export class PolicyEngine {
  private readonly doc: PolicyDocument;

  constructor(doc: PolicyDocument = EMPTY_POLICY) {
    this.doc = {
      defaultAction: doc.defaultAction ?? "allow",
      redactPatterns: doc.redactPatterns ?? EMPTY_POLICY.redactPatterns,
      rules: doc.rules ?? [],
    };
  }

  static fromFile(path: string | undefined): PolicyEngine {
    if (!path || !existsSync(path)) {
      return new PolicyEngine();
    }
    const raw = yaml.load(readFileSync(path, "utf8")) as PolicyDocument;
    return new PolicyEngine(raw ?? EMPTY_POLICY);
  }

  /**
   * Evaluate "server/tool" against ordered rules; first match wins.
   */
  evaluate(serverName: string, toolName: string): { action: PolicyAction; reason?: string; rule?: PolicyRule } {
    const key = `${serverName}/${toolName}`;
    for (const rule of this.doc.rules) {
      if (matchGlob(rule.match, key)) {
        return { action: rule.action, reason: rule.reason, rule };
      }
    }
    return { action: this.doc.defaultAction ?? "allow" };
  }

  /**
   * Deep-clone value and redact keys / string values matching patterns.
   */
  redact(value: unknown, extraPatterns: string[] = []): unknown {
    const patterns = [
      ...(this.doc.redactPatterns ?? []),
      ...extraPatterns,
    ].map((p) => p.toLowerCase());

    return redactValue(value, patterns);
  }
}

function matchGlob(pattern: string, value: string): boolean {
  // Convert simple glob (* and ?) to RegExp.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function redactValue(value: unknown, patterns: string[]): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Don't redact entire free-form strings unless they look like secrets.
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, patterns));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (patterns.some((p) => k.toLowerCase().includes(p))) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v, patterns);
      }
    }
    return out;
  }
  return value;
}

export { matchGlob };
