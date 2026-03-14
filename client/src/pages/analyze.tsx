import { useState, useEffect } from "react";
import { NavBar } from "@/components/NavBar";
import { useTheme } from "@/lib/theme";
import { logPageNav } from "@/lib/actionLogger";

interface ActionLogSummary {
  filename: string;
  sessionId: string;
  startedAt: string;
  eventCount: number;
}

export default function AnalyzePage() {
  const t = useTheme();
  const [logs, setLogs] = useState<ActionLogSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { logPageNav('analyze'); }, []);

  useEffect(() => {
    fetch("/api/action-logs")
      .then(r => r.ok ? r.json() : [])
      .then((data: ActionLogSummary[]) => setLogs(data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.text }}>
      <NavBar />
      <div
        style={{
          padding: "12px 16px 8px",
          borderBottom: `1px solid ${t.borderFaint}`,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: t.text,
            margin: 0,
          }}
        >
          RUN HISTORY
        </h1>
        <p style={{ fontSize: 10, color: t.textDim, margin: "4px 0 0" }}>
          Review past sessions and telemetry data
        </p>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: t.textDim,
              fontSize: 11,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Loading sessions...
          </div>
        ) : logs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
              color: t.textDim,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            <span style={{ fontSize: 32, opacity: 0.3 }}>&#x1F4CA;</span>
            <span style={{ fontSize: 11 }}>No run data yet. Hit the drag strip first.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {logs.map((log) => (
              <div
                key={log.filename}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 6,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>
                    {log.sessionId.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>
                    {new Date(log.startedAt).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: t.accent,
                    fontWeight: 600,
                  }}
                >
                  {log.eventCount} events
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
