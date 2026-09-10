import { useCallback, useEffect, useMemo, useState } from "react";

interface Session {
  id: string;
  source: string;
  status: string;
  title: string | null;
  cwd: string | null;
  baseCommit: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventRow {
  id: string;
  sessionId: string;
  source: string;
  type: string;
  title: string | null;
  message: string | null;
  toolName: string | null;
  toolArgsJson: string | null;
  filesJson: string | null;
  createdAt: string;
}

const COLUMNS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "running", label: "Running", statuses: ["running", "blocked"] },
  { key: "waiting", label: "Waiting approval", statuses: ["waiting_approval"] },
  { key: "done", label: "Completed", statuses: ["completed"] },
  { key: "failed", label: "Failed / rolled back", statuses: ["failed", "rolled_back"] },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function colorDiff(diff: string): React.ReactNode[] {
  return diff.split("\n").map((line, i) => {
    const cls = line.startsWith("+") && !line.startsWith("+++")
      ? "add"
      : line.startsWith("-") && !line.startsWith("---")
        ? "del"
        : "";
    return (
      <div key={i} className={cls}>
        {line || " "}
      </div>
    );
  });
}

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [wsLive, setWsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId]
  );

  const refresh = useCallback(async (sessionId?: string | null) => {
    try {
      setError(null);
      const sess = await api<Session[]>("/api/sessions");
      setSessions(sess);
      const sid = sessionId ?? selectedId ?? sess[0]?.id ?? null;
      if (sid && !sessionId && !selectedId) setSelectedId(sid);
      if (sid) {
        const ev = await api<EventRow[]>(`/api/events?sessionId=${encodeURIComponent(sid)}&limit=200`);
        setEvents(ev);
        try {
          const d = await api<{ diff: string }>(`/api/sessions/${encodeURIComponent(sid)}/diff`);
          setDiff(d.diff || "(no diff)");
        } catch {
          setDiff("(no cwd / not a git repo)");
        }
      } else {
        setEvents([]);
        setDiff("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (selectedId) void refresh(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => setWsLive(true);
    ws.onclose = () => setWsLive(false);
    ws.onmessage = () => {
      void refresh(selectedId);
    };
    return () => ws.close();
  }, [refresh, selectedId]);

  const approve = async (decision: "approve" | "reject") => {
    if (!selected) return;
    setBusy(true);
    try {
      await api("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selected.id, decision }),
      });
      await refresh(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!selected) return;
    if (!confirm(`Hard reset ${selected.cwd} to ${selected.baseCommit}?`)) return;
    setBusy(true);
    try {
      await api(`/api/sessions/${encodeURIComponent(selected.id)}/rollback`, {
        method: "POST",
      });
      await refresh(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Agent Control Room</h1>
          <p>Team devtools for a team of agents — timeline, approvals, rollback</p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <span className={`live ${wsLive ? "" : "off"}`}>{wsLive ? "● live" : "○ offline"}</span>
          <button onClick={() => void refresh(selectedId)}>Refresh</button>
        </div>
      </header>

      {error && (
        <div className="panel" style={{ padding: "0.85rem", marginBottom: "0.75rem", color: "var(--err)" }}>
          {error}
        </div>
      )}

      <div className="kanban">
        {COLUMNS.map((col) => (
          <div className="col" key={col.key}>
            <h2>{col.label}</h2>
            {sessions
              .filter((s) => col.statuses.includes(s.status))
              .map((s) => (
                <div
                  key={s.id}
                  className={`card ${selectedId === s.id ? "active" : ""}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="title">{s.title || s.id}</div>
                  <div className="meta">
                    {s.source} · <span className={`badge ${s.status}`}>{s.status}</span>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="main">
        <section className="panel">
          <div className="bar">
            <strong>Timeline</strong>
            <div className="spacer" />
            {selected && <span className={`badge ${selected.status}`}>{selected.status}</span>}
            {selected?.status === "waiting_approval" && (
              <>
                <button className="ok" disabled={busy} onClick={() => void approve("approve")}>
                  Approve
                </button>
                <button className="danger" disabled={busy} onClick={() => void approve("reject")}>
                  Reject
                </button>
              </>
            )}
            {selected?.baseCommit && selected?.cwd && (
              <button className="danger" disabled={busy} onClick={() => void rollback()}>
                Rollback
              </button>
            )}
          </div>
          <div className="timeline">
            {!selected ? (
              <div className="empty">Select a session</div>
            ) : events.length === 0 ? (
              <div className="empty">No events yet</div>
            ) : (
              events.map((e) => (
                <div className="ev" key={e.id}>
                  <div className="t">{new Date(e.createdAt).toLocaleTimeString()}</div>
                  <div className="body">
                    <div className="type">
                      {e.type}
                      {e.toolName ? ` · ${e.toolName}` : ""}
                    </div>
                    <div className="msg">{e.message || e.title || ""}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="bar">
            <strong>Diff preview</strong>
            <div className="spacer" />
            <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "var(--mono)" }}>
              {selected?.baseCommit ? `base ${selected.baseCommit.slice(0, 8)}` : "no base"}
            </span>
          </div>
          <pre className="diff-box">{diff ? colorDiff(diff) : "Select a session with a cwd"}</pre>
        </section>
      </div>
    </div>
  );
}
