import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useRoute, useLocation } from "wouter";
import { setActiveRace, relayListen, type RaceRelayMessage } from "@/lib/raceRelay";
import { useTheme } from "@/lib/theme";
import { NavBar } from "@/components/NavBar";

type RacePhase = "waiting" | "countdown" | "racing" | "finished";

interface OpponentState {
  speedMph: number;
  distanceFt: number;
  rpm: number;
  gear: number;
  elapsedMs: number;
}

interface RaceResultData {
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winnerTime: number;
  winnerSpeed: number;
  loserTime: number;
  loserSpeed: number;
  margin: number;
}

export default function RacePage() {
  const { user } = useAuth();
  const [, params] = useRoute("/race/:id");
  const [, setLocation] = useLocation();
  const raceId = params?.id || "";

  const [phase, setPhase] = useState<RacePhase>("waiting");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [opponent, setOpponent] = useState<{ userId: string; username: string } | null>(null);
  const [opponentState, setOpponentState] = useState<OpponentState | null>(null);
  const [opponentReady, setOpponentReady] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [result, setResult] = useState<RaceResultData | null>(null);
  const [error, setError] = useState("");
  const t = useTheme();

  const wsRef = useRef<WebSocket | null>(null);

  // Connect to race WebSocket
  useEffect(() => {
    if (!raceId || !user) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/race`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", raceId, userId: user.id, username: user.displayName || user.username }));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      switch (msg.type) {
        case "joined":
          if (msg.opponents?.length > 0) {
            setOpponent(msg.opponents[0]);
            if (msg.opponents[0].isReady) setOpponentReady(true);
          }
          break;
        case "opponentJoined":
          setOpponent({ userId: msg.userId, username: msg.username });
          break;
        case "opponentReady":
          setOpponentReady(true);
          break;
        case "countdown":
          setPhase("countdown");
          setCountdown(msg.count);
          break;
        case "go":
          setPhase("racing");
          setCountdown(null);
          break;
        case "opponentUpdate":
          setOpponentState(msg);
          break;
        case "opponentFinished":
          // Opponent crossed the line
          break;
        case "raceResult":
          setPhase("finished");
          setResult(msg);
          break;
        case "opponentDisconnected":
          setError(`${msg.username} disconnected!`);
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };

    ws.onclose = () => { };
    ws.onerror = () => setError("Connection error");

    return () => { ws.close(); };
  }, [raceId, user]);

  // Register this race as active so the dashboard sim relays data
  useEffect(() => {
    if (phase === "racing") {
      setActiveRace(raceId);
    }
    return () => setActiveRace(null);
  }, [phase, raceId]);

  // Listen for sim relay from the dashboard tab
  useEffect(() => {
    if (phase !== "racing") return;
    const cleanup = relayListen((msg: RaceRelayMessage) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (msg.type === "raceUpdate") {
        const { type: _, ...data } = msg;
        ws.send(JSON.stringify({ type: "raceUpdate", ...data }));
      } else if (msg.type === "raceFinish") {
        const { type: _, ...data } = msg;
        ws.send(JSON.stringify({ type: "finish", ...data }));
      }
    });
    return cleanup;
  }, [phase]);

  const markReady = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "ready" }));
    setIsReady(true);
  }, []);

  const sty = {
    page: { minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" as const },
    content: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 24, padding: "32px 16px" },
    card: { background: t.cardBg, border: "1px solid " + t.cardBorder, borderRadius: 16, padding: 32, width: "100%", maxWidth: 600, textAlign: "center" as const },
    bigNum: { fontSize: 120, fontWeight: 900, color: "#ff4444", lineHeight: 1 },
    btn: (bg: string, lg = false) => ({
      padding: lg ? "14px 40px" : "8px 18px", border: "none", borderRadius: 10, fontSize: lg ? 18 : 13,
      fontWeight: 700, cursor: "pointer", background: bg, color: "#fff", letterSpacing: "0.03em",
    }) as React.CSSProperties,
  };

  return (
    <div style={sty.page}>
      <NavBar />
      <div style={sty.content}>

      <h1 style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg,#ff4444,#ff8800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
        MULTIPLAYER RACE
      </h1>

      {error && (
        <div style={{ padding: "10px 20px", background: "rgba(255,0,0,0.15)", borderRadius: 8, color: "#ff6666", fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* WAITING PHASE */}
      {phase === "waiting" && (
        <div style={sty.card}>
          <div style={{ fontSize: 14, color: t.textDim, marginBottom: 16 }}>Race ID: {raceId}</div>

          <div style={{ display: "flex", justifyContent: "center", gap: 40, marginBottom: 24 }}>
            {/* You */}
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,68,68,0.2)", border: "2px solid #ff4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 24 }}>
                {isReady ? "✓" : "🏎"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.displayName || user?.username}</div>
              <div style={{ fontSize: 11, color: isReady ? "#22cc44" : "#888" }}>{isReady ? "READY" : "Not Ready"}</div>
            </div>

            <div style={{ alignSelf: "center", fontSize: 24, color: t.textDim }}>VS</div>

            {/* Opponent */}
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: opponent ? "rgba(34,102,255,0.2)" : "rgba(255,255,255,0.05)", border: `2px solid ${opponent ? "#2266ff" : "#333"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 24 }}>
                {opponent ? (opponentReady ? "✓" : "🏎") : "?"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: opponent ? t.text : t.textDim }}>
                {opponent?.username || "Waiting..."}
              </div>
              <div style={{ fontSize: 11, color: opponentReady ? "#22cc44" : "#888" }}>
                {opponent ? (opponentReady ? "READY" : "Not Ready") : "Connecting..."}
              </div>
            </div>
          </div>

          {!isReady && opponent && (
            <button onClick={markReady} style={sty.btn("#ff4444", true)}>
              I'M READY
            </button>
          )}

          {isReady && !opponentReady && (
            <div style={{ color: t.textMuted, fontSize: 14 }}>Waiting for opponent to ready up...</div>
          )}

          {!opponent && (
            <div style={{ color: t.textDim, fontSize: 14 }}>Waiting for opponent to connect...</div>
          )}
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === "countdown" && countdown !== null && (
        <div style={sty.card}>
          <div style={sty.bigNum}>{countdown}</div>
          <div style={{ fontSize: 18, color: "#888", marginTop: 12 }}>GET READY!</div>
        </div>
      )}

      {/* RACING */}
      {phase === "racing" && (
        <div style={sty.card}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#22cc44", marginBottom: 16 }}>GO! GO! GO!</div>
          <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 8 }}>
            Race is live! Switch to the <strong style={{ color: t.accent }}>Dashboard</strong> tab and launch your quarter mile run.
          </p>
          <p style={{ color: t.textDim, fontSize: 12 }}>
            Your sim data is automatically relayed to your opponent in real time.
          </p>
          {opponentState && (
            <div style={{ marginTop: 16, padding: 12, background: "rgba(34,102,255,0.1)", borderRadius: 8, fontSize: 13 }}>
              <strong style={{ color: "#2266ff" }}>{opponent?.username}</strong>
              : {opponentState.speedMph.toFixed(1)} mph | {opponentState.distanceFt.toFixed(0)} ft | Gear {opponentState.gear}
            </div>
          )}
          <a href="/" target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 16, padding: "10px 24px", background: "#ff4444", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Open Dashboard →
          </a>
        </div>
      )}

      {/* FINISHED */}
      {phase === "finished" && result && (
        <div style={sty.card}>
          <div style={{ fontSize: 16, color: t.textMuted, marginBottom: 8 }}>RACE COMPLETE</div>
          <div style={{
            fontSize: 48, fontWeight: 900, marginBottom: 20,
            color: result.winnerId === user?.id ? "#22cc44" : "#ff4444",
          }}>
            {result.winnerId === user?.id ? "YOU WIN! 🏆" : "YOU LOST"}
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase" }}>Winner</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#22cc44" }}>{result.winnerName}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: t.text }}>{result.winnerTime.toFixed(3)}s</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>@ {result.winnerSpeed.toFixed(1)} mph</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: t.textMuted, textTransform: "uppercase" }}>Loser</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#ff4444" }}>{result.loserName}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: t.text }}>{result.loserTime.toFixed(3)}s</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>@ {result.loserSpeed.toFixed(1)} mph</div>
            </div>
          </div>

          <div style={{ fontSize: 14, color: t.accent, fontWeight: 600 }}>
            Margin: {result.margin.toFixed(3)}s
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => setLocation("/")} style={sty.btn(t.btnHover)}>Dashboard</button>
            <button onClick={() => setLocation("/friends")} style={sty.btn("#ff4444")}>Race Again</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
