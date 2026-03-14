import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { NavBar } from "@/components/NavBar";
import { useTheme } from "@/lib/theme";
import { logPageNav } from "@/lib/actionLogger";

interface FriendEntry {
  friendshipId: string;
  friend: { id: string; username: string; displayName: string | null; isOnline: boolean; totalRaces: number; totalWins: number; bestQmTime: number | null };
  since: string;
}

interface PendingRequest {
  friendshipId: string;
  requester: { id: string; username: string; displayName: string | null };
  sentAt: string;
}

interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  isOnline: boolean;
  totalRaces: number;
  totalWins: number;
}

export default function SocialPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");
  const t = useTheme();

  useEffect(() => { logPageNav('social'); }, []);

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      setFriends(data.friends || []);
      setPending(data.pendingRequests || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) loadFriends();
  }, [user, loadFriends]);

  const searchUsers = async () => {
    if (searchQ.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ)}`);
      const data = await res.json();
      setSearchResults((data.users || []).filter((u: SearchUser) => u.id !== user?.id));
    } catch {}
    setSearching(false);
  };

  const sendRequest = async (addresseeId: string) => {
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId }),
      });
      const data = await res.json();
      if (res.ok) { setMsg("Friend request sent!"); loadFriends(); }
      else setMsg(data.error || "Failed");
    } catch { setMsg("Network error"); }
  };

  const acceptRequest = async (friendshipId: string) => {
    await fetch(`/api/friends/${friendshipId}/accept`, { method: "POST" });
    loadFriends();
    setMsg("Friend accepted!");
  };

  const declineRequest = async (friendshipId: string) => {
    await fetch(`/api/friends/${friendshipId}/decline`, { method: "POST" });
    loadFriends();
  };

  const removeFriend = async (friendshipId: string) => {
    if (!confirm("Remove this friend?")) return;
    await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
    loadFriends();
  };

  const challengeFriend = async (opponentId: string) => {
    try {
      const res = await fetch("/api/races/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId, trackType: "quarter_mile" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Race challenge sent!");
        setLocation(`/race/${data.race.id}`);
      } else {
        setMsg(data.error || "Failed to challenge");
      }
    } catch { setMsg("Network error"); }
  };

  if (!user) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.text }}>
        <NavBar />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <span style={{ fontSize: 11, color: t.textDim }}>Sign in to access social features</span>
          <a
            href="/auth"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: t.accent,
              textDecoration: "none",
              border: `1px solid ${t.accent}`,
              borderRadius: 4,
              padding: "6px 16px",
            }}
          >
            SIGN IN
          </a>
        </div>
      </div>
    );
  }

  const sty = {
    card: { background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 16 } as React.CSSProperties,
    h2: { fontSize: 12, fontWeight: 700, color: t.accent, margin: "0 0 12px", textTransform: "uppercase" as const, letterSpacing: "0.08em" } as React.CSSProperties,
    btn: (color: string) => ({
      padding: "5px 12px", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 600,
      cursor: "pointer", background: color, color: "#fff",
    }) as React.CSSProperties,
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.borderFaint}`, gap: 8 } as React.CSSProperties,
    dot: (on: boolean) => ({ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: on ? "#22cc44" : t.textDim, marginRight: 6 }) as React.CSSProperties,
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <NavBar />
      <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.1em", margin: "0 0 16px", color: t.text }}>
          SOCIAL
        </h1>

        {msg && (
          <div style={{ padding: "6px 12px", background: "rgba(0,180,216,0.1)", border: `1px solid ${t.accent}`, borderRadius: 6, color: t.accent, fontSize: 11, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {msg}
            <button onClick={() => setMsg("")} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontSize: 14 }}>&times;</button>
          </div>
        )}

        {/* Search */}
        <div style={sty.card}>
          <h2 style={sty.h2}>Find Racers</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchUsers()}
              placeholder="Search by username..."
              style={{
                flex: 1, padding: "7px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                borderRadius: 4, color: t.inputText, fontSize: 11, outline: "none", fontFamily: "inherit",
              }}
            />
            <button onClick={searchUsers} disabled={searching} style={sty.btn(t.accent)}>
              {searching ? "..." : "SEARCH"}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {searchResults.map(u => (
                <div key={u.id} style={sty.row}>
                  <div style={{ fontSize: 11 }}>
                    <span style={sty.dot(u.isOnline)} />
                    <strong>{u.displayName || u.username}</strong>
                    <span style={{ color: t.textDim, marginLeft: 6 }}>@{u.username}</span>
                    <span style={{ color: t.textMuted, marginLeft: 10, fontSize: 10 }}>{u.totalWins}W / {u.totalRaces}R</span>
                  </div>
                  <button onClick={() => sendRequest(u.id)} style={sty.btn("#2266ff")}>ADD</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div style={sty.card}>
            <h2 style={sty.h2}>Pending ({pending.length})</h2>
            {pending.map(p => (
              <div key={p.friendshipId} style={sty.row}>
                <div style={{ fontSize: 11 }}>
                  <strong>{p.requester.displayName || p.requester.username}</strong>
                  <span style={{ color: t.textDim, marginLeft: 6 }}>@{p.requester.username}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => acceptRequest(p.friendshipId)} style={sty.btn("#22cc44")}>ACCEPT</button>
                  <button onClick={() => declineRequest(p.friendshipId)} style={sty.btn("#cc2222")}>DECLINE</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friends */}
        <div style={sty.card}>
          <h2 style={sty.h2}>Friends ({friends.length})</h2>
          {friends.length === 0 ? (
            <p style={{ color: t.textDim, fontSize: 11, margin: 0 }}>No friends yet. Search above.</p>
          ) : (
            friends.map(f => (
              <div key={f.friendshipId} style={sty.row}>
                <div style={{ fontSize: 11 }}>
                  <span style={sty.dot(f.friend.isOnline)} />
                  <strong>{f.friend.displayName || f.friend.username}</strong>
                  <span style={{ color: t.textDim, marginLeft: 6 }}>@{f.friend.username}</span>
                  {f.friend.bestQmTime && (
                    <span style={{ color: t.accent, marginLeft: 10, fontSize: 10 }}>
                      QM {f.friend.bestQmTime.toFixed(3)}s
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => challengeFriend(f.friend.id)} style={sty.btn(t.accent)}>RACE</button>
                  <button onClick={() => removeFriend(f.friendshipId)} style={{ ...sty.btn("transparent"), color: t.textDim, border: `1px solid ${t.borderFaint}` }}>REMOVE</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
