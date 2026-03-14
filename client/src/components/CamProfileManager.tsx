// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM CAM PROFILE MANAGER — Create, manage, and apply custom cam profiles
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";
import { useTheme } from '@/lib/theme';

interface CamProfile {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  intakeLiftMm: number;
  exhaustLiftMm: number;
  intakeDuration: number;
  exhaustDuration: number;
  intakeLsa: number | null;
  exhaustLsa: number | null;
  overlap: number | null;
  isPublic: boolean;
  createdAt: string;
}

interface CamProfileManagerProps {
  onApply: (profile: {
    vtecIntakeLiftMm: number;
    vtecExhaustLiftMm: number;
    vtecIntakeDuration: number;
    vtecExhaustDuration: number;
  }) => void;
  currentProfile: {
    vtecIntakeLiftMm: number;
    vtecExhaustLiftMm: number;
    vtecIntakeDuration: number;
    vtecExhaustDuration: number;
  };
}

const STOCK_PROFILE = {
  vtecIntakeLiftMm: 10.6,
  vtecExhaustLiftMm: 9.4,
  vtecIntakeDuration: 240,
  vtecExhaustDuration: 228,
};

export function CamProfileManager({ onApply, currentProfile }: CamProfileManagerProps) {
  const t = useTheme();
  const [profiles, setProfiles] = useState<CamProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intakeLift, setIntakeLift] = useState(10.6);
  const [exhaustLift, setExhaustLift] = useState(9.4);
  const [intakeDuration, setIntakeDuration] = useState(240);
  const [exhaustDuration, setExhaustDuration] = useState(228);
  const [intakeLsa, setIntakeLsa] = useState(110);
  const [exhaustLsa, setExhaustLsa] = useState(110);
  const [isPublic, setIsPublic] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cam-profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(Array.isArray(data) ? data : data.profiles || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    try {
      const res = await fetch("/api/cam-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          intakeLiftMm: intakeLift,
          exhaustLiftMm: exhaustLift,
          intakeDuration,
          exhaustDuration,
          intakeLsa,
          exhaustLsa,
          overlap: intakeDuration / 2 + exhaustDuration / 2 - (intakeLsa + exhaustLsa),
          isPublic,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setName("");
        setDescription("");
        fetchProfiles();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create profile");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/cam-profiles/${id}`, { method: "DELETE" });
    fetchProfiles();
  };

  const handleApply = (p: CamProfile) => {
    onApply({
      vtecIntakeLiftMm: p.intakeLiftMm,
      vtecExhaustLiftMm: p.exhaustLiftMm,
      vtecIntakeDuration: p.intakeDuration,
      vtecExhaustDuration: p.exhaustDuration,
    });
  };

  const isStock =
    currentProfile.vtecIntakeLiftMm === STOCK_PROFILE.vtecIntakeLiftMm &&
    currentProfile.vtecExhaustLiftMm === STOCK_PROFILE.vtecExhaustLiftMm &&
    currentProfile.vtecIntakeDuration === STOCK_PROFILE.vtecIntakeDuration &&
    currentProfile.vtecExhaustDuration === STOCK_PROFILE.vtecExhaustDuration;

  const sty = {
    container: { background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 16, fontFamily: "'Inter', system-ui, sans-serif" } as React.CSSProperties,
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } as React.CSSProperties,
    title: { fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: "0.05em" } as React.CSSProperties,
    btn: (bg: string, sm = false) => ({
      padding: sm ? "4px 10px" : "6px 14px", border: "none", borderRadius: 6, fontSize: sm ? 11 : 12,
      fontWeight: 600, cursor: "pointer", background: bg, color: "#fff",
    }) as React.CSSProperties,
    profileCard: { background: t.inputBg, border: `1px solid ${t.borderFaint}`, borderRadius: 8, padding: 10, marginBottom: 8 } as React.CSSProperties,
    label: { fontSize: 10, color: t.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em" },
    value: { fontSize: 13, color: t.text, fontWeight: 600 },
    input: { width: "100%", padding: "6px 8px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 6, color: t.inputText, fontSize: 12, fontFamily: "inherit" } as React.CSSProperties,
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 } as React.CSSProperties,
  };

  return (
    <div style={sty.container}>
      <div style={sty.header}>
        <span style={sty.title}>🎯 CAM PROFILES</span>
        <div style={{ display: "flex", gap: 6 }}>
          {!isStock && (
            <button style={sty.btn("rgba(255,255,255,0.1)", true)} onClick={() => onApply(STOCK_PROFILE)}>
              Reset Stock
            </button>
          )}
          <button style={sty.btn("#3b82f6", true)} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ Create"}
          </button>
        </div>
      </div>

      {/* Current active profile indicator */}
      <div style={{ marginBottom: 10, padding: 8, background: "rgba(34,197,94,0.1)", borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)" }}>
        <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>ACTIVE VTEC PROFILE</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: t.textMuted }}>
          <span>Intake: {currentProfile.vtecIntakeLiftMm}mm / {currentProfile.vtecIntakeDuration}°</span>
          <span>Exhaust: {currentProfile.vtecExhaustLiftMm}mm / {currentProfile.vtecExhaustDuration}°</span>
        </div>
        {isStock && <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>Stock B16A2</div>}
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...sty.profileCard, borderColor: "rgba(59,130,246,0.3)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 8 }}>New Custom Cam</div>
          {error && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 6 }}>{error}</div>}
          <div style={{ marginBottom: 8 }}>
            <input placeholder="Profile name..." value={name} onChange={e => setName(e.target.value)} style={sty.input} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} style={sty.input} />
          </div>
          <div style={sty.row}>
            <div>
              <div style={sty.label}>Intake Lift (mm)</div>
              <input type="number" step="0.1" min="5" max="15" value={intakeLift} onChange={e => setIntakeLift(+e.target.value)} style={sty.input} />
            </div>
            <div>
              <div style={sty.label}>Exhaust Lift (mm)</div>
              <input type="number" step="0.1" min="5" max="15" value={exhaustLift} onChange={e => setExhaustLift(+e.target.value)} style={sty.input} />
            </div>
          </div>
          <div style={sty.row}>
            <div>
              <div style={sty.label}>Intake Duration (°)</div>
              <input type="number" step="2" min="180" max="320" value={intakeDuration} onChange={e => setIntakeDuration(+e.target.value)} style={sty.input} />
            </div>
            <div>
              <div style={sty.label}>Exhaust Duration (°)</div>
              <input type="number" step="2" min="180" max="320" value={exhaustDuration} onChange={e => setExhaustDuration(+e.target.value)} style={sty.input} />
            </div>
          </div>
          <div style={sty.row}>
            <div>
              <div style={sty.label}>Intake LSA (°)</div>
              <input type="number" step="0.5" min="95" max="125" value={intakeLsa} onChange={e => setIntakeLsa(+e.target.value)} style={sty.input} />
            </div>
            <div>
              <div style={sty.label}>Exhaust LSA (°)</div>
              <input type="number" step="0.5" min="95" max="125" value={exhaustLsa} onChange={e => setExhaustLsa(+e.target.value)} style={sty.input} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="cam-public" />
            <label htmlFor="cam-public" style={{ fontSize: 11, color: t.textMuted }}>Share publicly</label>
          </div>
          <button style={sty.btn("#22c55e")} onClick={handleCreate}>Save Profile</button>
        </div>
      )}

      {/* Saved profiles list */}
      {loading ? (
        <div style={{ color: t.textDim, fontSize: 12, textAlign: "center", padding: 12 }}>Loading...</div>
      ) : profiles.length === 0 ? (
        <div style={{ color: t.textDim, fontSize: 11, textAlign: "center", padding: 12 }}>
          No custom profiles yet. Create one above!
        </div>
      ) : (
        profiles.map(p => (
          <div key={p.id} style={sty.profileCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{p.name}</span>
                {p.isPublic && <span style={{ fontSize: 9, color: "#3b82f6", marginLeft: 6 }}>PUBLIC</span>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={sty.btn("#22c55e", true)} onClick={() => handleApply(p)}>Apply</button>
                <button style={sty.btn("rgba(239,68,68,0.3)", true)} onClick={() => handleDelete(p.id)}>✕</button>
              </div>
            </div>
            {p.description && <div style={{ fontSize: 11, color: t.textDim, marginBottom: 4 }}>{p.description}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 11, color: t.textMuted }}>
              <span>I: {p.intakeLiftMm}mm / {p.intakeDuration}°</span>
              <span>E: {p.exhaustLiftMm}mm / {p.exhaustDuration}°</span>
              {p.intakeLsa != null && <span>LSA: {p.intakeLsa}°</span>}
              {p.overlap != null && <span>Overlap: {p.overlap}°</span>}
            </div>
          </div>
        ))
      )}

      {/* ── PRESET AFTERMARKET CAMS ── */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${t.borderFaint}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>POPULAR AFTERMARKET CAMS</div>
        {[
          { name: "Skunk2 Stage 2", i: { lift: 11.68, dur: 252 }, e: { lift: 10.67, dur: 240 } },
          { name: "Toda A2", i: { lift: 11.5, dur: 256 }, e: { lift: 10.5, dur: 244 } },
          { name: "Brian Crower Stage 2", i: { lift: 12.2, dur: 264 }, e: { lift: 11.2, dur: 252 } },
          { name: "Kelford 148-A", i: { lift: 11.43, dur: 252 }, e: { lift: 10.41, dur: 240 } },
        ].map((cam, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < 3 ? `1px solid ${t.borderFaint}` : "none" }}>
            <div>
              <span style={{ fontSize: 12, color: t.text }}>{cam.name}</span>
              <span style={{ fontSize: 10, color: t.textDim, marginLeft: 8 }}>I:{cam.i.lift}/{cam.i.dur}° E:{cam.e.lift}/{cam.e.dur}°</span>
            </div>
            <button
              style={sty.btn("rgba(255,136,0,0.3)", true)}
              onClick={() => onApply({
                vtecIntakeLiftMm: cam.i.lift,
                vtecExhaustLiftMm: cam.e.lift,
                vtecIntakeDuration: cam.i.dur,
                vtecExhaustDuration: cam.e.dur,
              })}
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
