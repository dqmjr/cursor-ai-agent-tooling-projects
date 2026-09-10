import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentEventSchema } from "./schema.js";
import { Store } from "./store.js";

describe("AgentEventSchema", () => {
  it("parses a minimal event", () => {
    const e = AgentEventSchema.parse({
      sessionId: "s1",
      type: "task_started",
      title: "Implement login",
    });
    assert.equal(e.source, "generic");
    assert.equal(e.sessionId, "s1");
  });
});

describe("Store", () => {
  it("creates sessions and updates status from events", () => {
    const dir = mkdtempSync(join(tmpdir(), "acr-"));
    const store = new Store(join(dir, "db.sqlite"));

    store.ingest({
      sessionId: "sess-1",
      source: "claude-code",
      type: "task_started",
      title: "Fix bug",
      cwd: dir,
      baseCommit: "abc123",
    });
    store.ingest({
      sessionId: "sess-1",
      source: "claude-code",
      type: "waiting_for_approval",
      message: "About to write files",
      files: [{ path: "a.ts", kind: "modified", diff: "-a\n+b\n" }],
    });

    const session = store.getSession("sess-1");
    assert.equal(session?.status, "waiting_approval");
    assert.equal(session?.baseCommit, "abc123");
    assert.equal(store.listEvents("sess-1").length, 2);

    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
