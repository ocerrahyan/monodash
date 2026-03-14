import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useTheme } from "@/lib/theme";
import { NavBar } from "@/components/NavBar";

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

export default function FriendsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");
  const t = useTheme();

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      setFriends(data.friends || []);
      setPending(data.pendingRequests || []);
    } catch {}
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

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

  const sty = {
    page: { minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', system-ui, sans-serif" } as React.CSSProperties,
    content: { padding: "16px 24px", maxWidth: 800, margin: "0 auto", width: "100%", boxSizing: "border-box" as const } as React.CSSProperties,
    card: { background: t.cardBg, border: "1px solid " + t.cardBorder, borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
    h2: { fontSize: 18, fontWeight: 700, color: t.accent, margin: "0 0 14px", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    btn: (bg: string) => ({
      padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
      cursor: "pointer", background: bg, color: "#fff", transition: "opacity 0.2s",
    }) as React.CSSProperties,
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + t.borderFaint, flexWrap: "wrap" as const, gap: 8 } as React.CSSProperties,
    online: (on: boolean) => ({ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: on ? "#22cc44" : t.textDim, marginRight: 8 }) as React.CSSProperties,
  };

  return (
    <div style={sty.page}>
      <NavBar />
      <div style={sty.content}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "16px 0", background: "linear-gradient(135deg,#ff4444,#ff8800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        FRIENDS & RACING
      </h1>

      {msg && (
        <div style={{ padding: "8px 14px", background: "rgba(0,255,100,0.1)", border: "1px solid rgba(0,255,100,0.2)", borderRadius: 8, color: "#66ff88", fontSize: 13, marginBottom: 16 }}>
          {msg}
          <button onClick={() => setMsg("")} style={{ float: "right", background: "none", border: "none", color: "#66ff88", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* Search Users */}
      <div style={sty.card}>
        <h2 style={sty.h2}>Find Racers</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchUsers()}
            placeholder="Search by username..."
            style={{
              flex: 1, padding: "8px 12px", background: t.inputBg, border: "1px solid " + t.inputBorder,
              borderRadius: 8, color: t.inputText, fontSize: 14, outline: "none",
            }}
          />
          <button onClick={searchUsers} disabled={searching} style={sty.btn("#ff4444")}>
            {searching ? "..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {searchResults.map(u => (
              <div key={u.id} style={sty.row}>
                <div>
                  <span style={sty.online(u.isOnline)} />
                  <strong>{u.displayName || u.username}</strong>
                  <span style={{ color: t.textDim, fontSize: 12, marginLeft: 8 }}>@{u.username}</span>
                  <span style={{ color: t.textMuted, fontSize: 11, marginLeft: 12 }}>{u.totalWins}W / {u.totalRaces}R</span>
                </div>
                <button onClick={() => sendRequest(u.id)} style={sty.btn("#2266ff")}>Add Friend</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div style={sty.card}>
          <h2 style={sty.h2}>Pending Requests ({pending.length})</h2>
          {pending.map(p => (
            <div key={p.friendshipId} style={sty.row}>
              <div>
                <strong>{p.requester.displayName || p.requester.username}</strong>
                <span style={{ color: t.textDim, fontSize: 12, marginLeft: 8 }}>@{p.requester.username}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => acceptRequest(p.friendshipId)} style={sty.btn("#22cc44")}>Accept</button>
                <button onClick={() => declineRequest(p.friendshipId)} style={sty.btn("#cc2222")}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div style={sty.card}>
        <h2 style={sty.h2}>My Friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <p style={{ color: t.textDim, fontSize: 13 }}>No friends yet. Search for racers above!</p>
        ) : (
          friends.map(f => (
            <div key={f.friendshipId} style={sty.row}>
              <div>
                <span style={sty.online(f.friend.isOnline)} />
                <strong>{f.friend.displayName || f.friend.username}</strong>
                <span style={{ color: t.textDim, fontSize: 12, marginLeft: 8 }}>@{f.friend.username}</span>
                <span style={{ color: t.textMuted, fontSize: 11, marginLeft: 12 }}>{f.friend.totalWins}W / {f.friend.totalRaces}R</span>
                {f.friend.bestQmTime && (
                  <span style={{ color: t.accent, fontSize: 11, marginLeft: 8 }}>Best: {f.friend.bestQmTime.toFixed(3)}s</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {f.friend.isOnline && (
                  <button onClick={() => challengeFriend(f.friend.id)} style={sty.btn("#ff4444")}>🏁 Race!</button>
                )}
                <button onClick={() => removeFriend(f.friendshipId)} style={sty.btn("rgba(255,255,255,0.08)")}>Remove</button>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
