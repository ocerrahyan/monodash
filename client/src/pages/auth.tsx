import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useTheme } from "@/lib/theme";

export default function AuthPage() {
  const { login, register, error } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const t = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, displayName || undefined);
      }
      setLocation("/");
    } catch (err: any) {
      setLocalError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: t.cardBg,
        border: "1px solid " + t.cardBorder,
        borderRadius: 16,
        padding: "40px 24px",
        boxSizing: "border-box",
        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        margin: "0 16px",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            background: "linear-gradient(135deg, #ff4444, #ff8800)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
            letterSpacing: "-0.02em",
          }}>
            MONO5
          </h1>
          <p style={{ color: t.textDim, fontSize: 13, marginTop: 6 }}>
            Honda B16A2 Drag Racing Simulator
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: t.inputBg, borderRadius: 8, padding: 3 }}>
          {(["login", "register"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setLocalError(""); }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: mode === m ? "rgba(255,68,68,0.2)" : "transparent",
                color: mode === m ? "#ff4444" : t.textDim,
                transition: "all 0.2s",
              }}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ color: t.textMuted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Username
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={24}
                placeholder="e.g. vtec_king"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  background: t.inputBg,
                  border: "1px solid " + t.inputBorder,
                  borderRadius: 8,
                  color: t.inputText,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <label style={{ color: t.textMuted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  background: t.inputBg,
                  border: "1px solid " + t.inputBorder,
                  borderRadius: 8,
                  color: t.inputText,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </label>

            {mode === "register" && (
              <label style={{ color: t.textMuted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Display Name (optional)
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={48}
                  placeholder="Your racer name"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    background: t.inputBg,
                    border: "1px solid " + t.inputBorder,
                    borderRadius: 8,
                    color: t.inputText,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </label>
            )}
          </div>

          {(localError || error) && (
            <div style={{
              marginTop: 14,
              padding: "8px 12px",
              background: "rgba(255,0,0,0.1)",
              border: "1px solid rgba(255,0,0,0.2)",
              borderRadius: 8,
              color: "#ff6666",
              fontSize: 13,
            }}>
              {localError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: 20,
              padding: "12px 0",
              background: submitting ? "#444" : "linear-gradient(135deg, #ff4444, #cc2200)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              letterSpacing: "0.03em",
              transition: "all 0.2s",
            }}
          >
            {submitting ? "Please wait..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>
      </div>
    </div>
  );
}
