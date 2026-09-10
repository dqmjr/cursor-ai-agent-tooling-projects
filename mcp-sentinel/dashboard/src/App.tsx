import { useCallback, useEffect, useState } from "react";

interface Stats {
  total: number;
  errors: number;
  denied: number;
  avgDurationMs: number;
}

interface Session {
  sessionId: string;
  count: number;
  lastAt: string;
}

interface AuditEvent {
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

interface VerifyResult {
  ok: boolean;
  checked: number;
  brokenAtId?: number;
  detail?: string;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function pretty(json: string | null): string {
  if (!json) return "null";
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [s, sess, ev, v] = await Promise.all([
        api<Stats>("/api/stats"),
        api<Session[]>("/api/sessions"),
        api<AuditEvent[]>(
          selectedSession
            ? `/api/events?sessionId=${encodeURIComponent(selectedSession)}&limit=200`
            : "/api/events?limit=200"
        ),
        api<VerifyResult>("/api/verify"),
      ]);
      setStats(s);
      setSessions(sess);
      setEvents(ev);
      setVerify(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates via Server-Sent Events (falls back to polling if SSE fails).
  useEffect(() => {
    const es = new EventSource("/api/stream");
    let pollId: ReturnType<typeof setInterval> | undefined;

    es.onopen = () => setLive(true);
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as { type: string };
        if (data.type === "change" || data.type === "hello") {
          void refresh();
        }
      } catch {
        // ignore malformed frames
      }
    };
    es.onerror = () => {
      setLive(false);
      es.close();
      pollId = setInterval(() => void refresh(), 3000);
    };

    return () => {
      es.close();
      if (pollId) clearInterval(pollId);
    };
  }, [refresh]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>mcp-sentinel</h1>
          <p>MCP observability &amp; policy gateway — local audit timeline</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className={live ? "verify-ok" : "verify-bad"}>
            {live ? "● live" : "○ polling"}
          </span>
          {verify && (
            <span className={verify.ok ? "verify-ok" : "verify-bad"}>
              chain {verify.ok ? `ok (${verify.checked})` : `BROKEN @ ${verify.brokenAtId}`}
            </span>
          )}
          <button className="primary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="panel" style={{ padding: "1rem", marginBottom: "1rem", color: "var(--err)" }}>
          {error} — is the dashboard server running? (`mcp-sentinel dashboard -c examples/sentinel.json`)
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="label">Events</div>
          <div className="value">{stats?.total ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="label">Errors</div>
          <div className="value">{stats?.errors ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="label">Denied</div>
          <div className="value">{stats?.denied ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="label">Avg ms</div>
          <div className="value">{stats?.avgDurationMs ?? "—"}</div>
        </div>
      </div>

      <div className="layout">
        <aside className="panel">
          <h2>Sessions</h2>
          <ul className="session-list">
            <li>
              <button
                className={selectedSession === null ? "active" : ""}
                onClick={() => setSelectedSession(null)}
              >
                <div className="sid">All sessions</div>
              </button>
            </li>
            {sessions.map((s) => (
              <li key={s.sessionId}>
                <button
                  className={selectedSession === s.sessionId ? "active" : ""}
                  onClick={() => setSelectedSession(s.sessionId)}
                >
                  <div className="sid">{s.sessionId}</div>
                  <div className="meta">
                    {s.count} events · {formatTime(s.lastAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel">
          <div className="toolbar">
            <strong>Timeline</strong>
            <div className="spacer" />
            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {events.length} shown
            </span>
          </div>
          <div className="events">
            {events.length === 0 ? (
              <div className="empty">No audit events yet. Point an MCP client at the proxy.</div>
            ) : (
              events.map((e) => (
                <div
                  key={e.id}
                  className={`event ${selected?.id === e.id ? "selected" : ""}`}
                  onClick={() => setSelected(e)}
                >
                  <div className="time">#{e.id}</div>
                  <div>
                    <div className="title">
                      {e.serverName}/{e.toolName}
                    </div>
                    <div className="sub">
                      {formatTime(e.createdAt)} · {e.durationMs}ms
                      {e.isError ? " · error" : ""}
                    </div>
                  </div>
                  <div>
                    <span className={`badge ${e.policyAction}`}>{e.policyAction}</span>
                    {e.isError ? (
                      <span className="badge error" style={{ marginLeft: 6 }}>
                        err
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {selected && (
        <div className="detail">
          <h3>
            Replay · {selected.serverName}/{selected.toolName}{" "}
            <span className={`badge ${selected.policyAction}`}>{selected.policyAction}</span>
          </h3>
          <div className="cols">
            <div>
              <div className="label" style={{ color: "var(--muted)", marginBottom: 6 }}>
                Arguments (redacted)
              </div>
              <pre>{pretty(selected.argumentsJson)}</pre>
            </div>
            <div>
              <div className="label" style={{ color: "var(--muted)", marginBottom: 6 }}>
                Result
              </div>
              <pre>{pretty(selected.resultJson)}</pre>
            </div>
          </div>
          <div className="chain">
            prev: {selected.prevHash}
            <br />
            hash: {selected.chainHash}
          </div>
        </div>
      )}
    </div>
  );
}
