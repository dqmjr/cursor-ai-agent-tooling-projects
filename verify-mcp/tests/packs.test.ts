import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markdownLinksPack } from "../src/packs/markdown-links.js";
import { jsonSchemaPack } from "../src/packs/json-schema.js";
import { secretsPack } from "../src/packs/secrets.js";

describe("markdown-links", () => {
  it("flags broken relative links", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vm-"));
    const md = join(dir, "README.md");
    writeFileSync(md, "# Hi\n\nSee [missing](./nope.md) and [ok](./ok.md)\n");
    writeFileSync(join(dir, "ok.md"), "ok");
    const result = await markdownLinksPack.verify({ path: md });
    assert.equal(result.pass, false);
    assert.equal(result.findings.length, 1);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("json-schema", () => {
  it("validates against an inline schema", async () => {
    const result = await jsonSchemaPack.verify({
      path: "inline.json",
      content: JSON.stringify({ name: "a", age: 3 }),
      options: {
        schema: {
          type: "object",
          required: ["name", "age"],
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        },
      },
    });
    assert.equal(result.pass, true);

    const bad = await jsonSchemaPack.verify({
      path: "inline.json",
      content: JSON.stringify({ name: 1 }),
      options: {
        schema: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
        },
      },
    });
    assert.equal(bad.pass, false);
  });
});

describe("secrets", () => {
  it("detects AWS-like keys", async () => {
    const result = await secretsPack.verify({
      path: "leak.txt",
      content: "key = AKIAIOSFODNN7EXAMPLE\n",
    });
    assert.equal(result.pass, false);
    assert.ok(result.findings.some((f) => f.message.includes("AWS")));
  });
});
