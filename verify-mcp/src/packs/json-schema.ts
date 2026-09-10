/**
 * JSON Schema validator pack (Ajv).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import type { VerifierPack, VerifyFinding, VerifyResult } from "../types.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as new (opts?: object) => {
  compile: (schema: object) => ((data: unknown) => boolean) & {
    errors?: Array<Record<string, unknown>> | null;
  };
};

export const jsonSchemaPack: VerifierPack = {
  name: "json-schema",
  description: "Validate a JSON file against a JSON Schema (options.schema or options.schemaPath)",
  verify(ctx): VerifyResult {
    const filePath = resolve(ctx.cwd ?? process.cwd(), ctx.path);
    const raw = ctx.content ?? readFileSync(filePath, "utf8");
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return {
        pack: this.name,
        pass: false,
        findings: [
          {
            severity: "error",
            message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            path: filePath,
          },
        ],
        summary: `Invalid JSON in ${ctx.path}`,
      };
    }

    const opts = ctx.options ?? {};
    let schema: object;
    if (opts.schema && typeof opts.schema === "object") {
      schema = opts.schema as object;
    } else if (typeof opts.schemaPath === "string") {
      const schemaFile = resolve(ctx.cwd ?? process.cwd(), opts.schemaPath);
      schema = JSON.parse(readFileSync(schemaFile, "utf8")) as object;
    } else {
      return {
        pack: this.name,
        pass: false,
        findings: [
          {
            severity: "error",
            message: "Provide options.schema or options.schemaPath",
          },
        ],
        summary: "Missing schema",
      };
    }

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const ok = validate(data);
    const findings: VerifyFinding[] = [];
    if (!ok && validate.errors) {
      for (const e of validate.errors) {
        findings.push({
          severity: "error",
          message: `${e.instancePath || "/"} ${e.message ?? "invalid"}`,
          path: filePath,
          details: e,
        });
      }
    }

    return {
      pack: this.name,
      pass: Boolean(ok),
      findings,
      summary: ok
        ? `Schema valid: ${ctx.path}`
        : `Schema invalid: ${findings.length} error(s) in ${ctx.path}`,
    };
  },
};
