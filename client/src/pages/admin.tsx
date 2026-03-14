import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useTheme } from "@/lib/theme";
import { NavBar } from "@/components/NavBar";

interface DashboardStats {
  totalUsers: number;
  onlineUsers: number;
  totalRaces: number;
  activeRaces: number;
  completedRaces: number;
  totalResults: number;
  eventLogCount: number;
  activeSessionCount: number;
  wsRacesActive: number;
  wsPlayersConnected: number;
}

interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  isOnline: boolean;
  totalRaces: number;
  totalWins: number;
  bestQmTime: number | null;
  bestQmSpeed: number | null;
  createdAt: string;
  lastSeen: string;
}

interface AdminRace {
  id: string;
  challengerId: string;
  opponentId: string;
  status: string;
  winnerId: string | null;
  trackType: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface AdminEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface RaceResult {
  id: string;
  raceId: string;
  userId: string;
  finishTime: number | null;
  topSpeedMph: number | null;
  reactionTime: number | null;
  sixtyFootTime: number | null;
  eighthMileTime: number | null;
  eighthMileSpeed: number | null;
  quarterMileTime: number | null;
  quarterMileSpeed: number | null;
  peakHp: number | null;
  peakTorque: number | null;
  isWinner: boolean;
  isDnf: boolean;
  createdAt: string;
}

type Tab = "overview" | "users" | "races" | "results" | "events" | "logs";

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [races, setRaces] = useState<AdminRace[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<AdminEvent[]>([]);
  const [actionSessions, setActionSessions] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [eventFilter, setEventFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const t = useTheme();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      const data = await res.json();
      setStats(data.stats);
      setRecentEvents(data.recentEvents || []);
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchRaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/races");
      const data = await res.json();
      setRaces(data.races || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/results");
      const data = await res.json();
      setResults(data.results || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const url = eventFilter
        ? `/api/admin/event-log?eventType=${encodeURIComponent(eventFilter)}&limit=500`
        : "/api/admin/event-log?limit=500";
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {}
    setLoading(false);
  }, [eventFilter]);

  const fetchActionSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/action-logs/sessions");
      const data = await res.json();
      setActionSessions(data.sessions || []);
    } catch {}
  }, []);

  const fetchUserDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      setUserDetail(data);
      setSelectedUser(id);
    } catch {}
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => {
    if (tab === "users") fetchUsers();
    if (tab === "races") fetchRaces();
    if (tab === "results") fetchResults();
    if (tab === "events") fetchEvents();
    if (tab === "logs") fetchActionSessions();
  }, [tab, fetchUsers, fetchRaces, fetchResults, fetchEvents, fetchActionSessions]);

  // Auto-refresh dashboard stats every 10s
  useEffect(() => {
    const t = setInterval(fetchDashboard, 10_000);
    return () => clearInterval(t);
  }, [fetchDashboard]);

  if (!user?.isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: "#ff4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>
        ACCESS DENIED — Admin only
      </div>
    );
  }

  const sty = {
    page: { minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', system-ui, sans-serif" } as React.CSSProperties,
    header: { padding: "16px 24px", background: "rgba(255,68,68,0.08)", borderBottom: "1px solid rgba(255,68,68,0.15)", display: "flex", alignItems: "center", gap: 16 } as React.CSSProperties,
    tabs: { display: "flex", gap: 2, padding: "0 24px", background: t.navBg, borderBottom: "1px solid " + t.borderFaint } as React.CSSProperties,
    tab: (active: boolean) => ({
      padding: "10px 18px", cursor: "pointer", fontSize: 12, fontWeight: 600,
      textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "none",
      background: active ? "rgba(255,68,68,0.15)" : "transparent",
      color: active ? "#ff4444" : t.textDim,
      borderBottom: active ? "2px solid #ff4444" : "2px solid transparent",
    }) as React.CSSProperties,
    content: { padding: 24 } as React.CSSProperties,
    card: { background: t.cardBg, border: "1px solid " + t.cardBorder, borderRadius: 10, padding: 16, marginBottom: 16 } as React.CSSProperties,
    stat: { textAlign: "center" as const, padding: 16 },
    statValue: { fontSize: 32, fontWeight: 900 } as React.CSSProperties,
    statLabel: { fontSize: 11, color: t.textDim, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 4 } as React.CSSProperties,
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 } as React.CSSProperties,
    th: { textAlign: "left" as const, padding: "8px 10px", color: t.textDim, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, borderBottom: "1px solid " + t.border } as React.CSSProperties,
    td: { padding: "8px 10px", borderBottom: "1px solid " + t.borderFaint } as React.CSSProperties,
    btn: (bg: string) => ({ padding: "5px 12px", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", background: bg, color: "#fff" }) as React.CSSProperties,
    badge: (color: string) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${color}22`, color, textTransform: "uppercase" as const }) as React.CSSProperties,
    online: (on: boolean) => ({ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: on ? "#22cc44" : "#555", marginRight: 6 }) as React.CSSProperties,
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "#ffaa00";
      case "accepted": case "countdown": return "#2266ff";
      case "racing": return "#22cc44";
      case "finished": return "#888";
      case "cancelled": return "#ff4444";
      default: return "#666";
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString();
  const fmtTime = (t: number | null) => t != null ? `${t.toFixed(3)}s` : "—";

  return (
    <div style={sty.page}>
      <NavBar />
      {/* Header */}
      <div style={sty.header}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, background: "linear-gradient(135deg,#ff4444,#ff8800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          ADMIN DASHBOARD
        </h1>
        <span style={{ marginLeft: "auto", fontSize: 12, color: t.textDim }}>Logged in as: <strong style={{ color: "#ff4444" }}>{user.displayName || user.username}</strong></span>
      </div>

      {/* Tabs */}
      <div style={sty.tabs}>
        {(["overview", "users", "races", "results", "events", "logs"] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)} style={sty.tab(tab === tb)}>{tb}</button>
        ))}
      </div>

      <div style={sty.content}>
        {/* OVERVIEW TAB */}
        {tab === "overview" && stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Users", value: stats.totalUsers, color: "#2266ff" },
                { label: "Online Now", value: stats.onlineUsers, color: "#22cc44" },
                { label: "Total Races", value: stats.totalRaces, color: "#ff8800" },
                { label: "Active Races", value: stats.activeRaces, color: "#ff4444" },
                { label: "Completed", value: stats.completedRaces, color: "#888" },
              ].map(s => (
                <div key={s.label} style={sty.card}>
                  <div style={sty.stat}>
                    <div style={{ ...sty.statValue, color: s.color }}>{s.value}</div>
                    <div style={sty.statLabel}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "WS Players Connected", value: stats.wsPlayersConnected, color: "#22cc44" },
                { label: "WS Races Active", value: stats.wsRacesActive, color: "#ff4444" },
                { label: "Event Log Entries", value: stats.eventLogCount, color: "#2266ff" },
              ].map(s => (
                <div key={s.label} style={sty.card}>
                  <div style={sty.stat}>
                    <div style={{ ...sty.statValue, color: s.color, fontSize: 24 }}>{s.value}</div>
                    <div style={sty.statLabel}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Events */}
            <div style={sty.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#ff4444", textTransform: "uppercase" }}>Recent Activity</h3>
              <table style={sty.table}>
                <thead>
                  <tr>
                    <th style={sty.th}>Time</th>
                    <th style={sty.th}>Event</th>
                    <th style={sty.th}>Actor</th>
                    <th style={sty.th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.slice(0, 20).map(e => (
                    <tr key={e.id}>
                      <td style={sty.td}>{fmtDate(e.createdAt)}</td>
                      <td style={sty.td}><span style={sty.badge("#ff8800")}>{e.eventType}</span></td>
                      <td style={sty.td}>{e.actorId || "—"}</td>
                      <td style={{ ...sty.td, fontSize: 11, color: t.textMuted, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {JSON.stringify(e.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={sty.card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#2266ff" }}>All Users ({users.length})</h3>
                <table style={sty.table}>
                  <thead>
                    <tr>
                      <th style={sty.th}>Status</th>
                      <th style={sty.th}>Username</th>
                      <th style={sty.th}>Display Name</th>
                      <th style={sty.th}>Races</th>
                      <th style={sty.th}>Wins</th>
                      <th style={sty.th}>Best QM</th>
                      <th style={sty.th}>Joined</th>
                      <th style={sty.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ cursor: "pointer", background: selectedUser === u.id ? "rgba(255,68,68,0.05)" : undefined }} onClick={() => fetchUserDetail(u.id)}>
                        <td style={sty.td}><span style={sty.online(u.isOnline)} />{u.isOnline ? "Online" : "Offline"}</td>
                        <td style={sty.td}><strong>@{u.username}</strong> {u.isAdmin && <span style={sty.badge("#ff4444")}>admin</span>}</td>
                        <td style={sty.td}>{u.displayName || "—"}</td>
                        <td style={sty.td}>{u.totalRaces}</td>
                        <td style={sty.td}>{u.totalWins}</td>
                        <td style={sty.td}>{u.bestQmTime ? `${u.bestQmTime.toFixed(3)}s` : "—"}</td>
                        <td style={sty.td}>{fmtDate(u.createdAt)}</td>
                        <td style={sty.td}><button style={sty.btn("rgba(255,255,255,0.08)")} onClick={() => fetchUserDetail(u.id)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Detail Sidebar */}
            {selectedUser && userDetail && (
              <div style={{ width: 340, flexShrink: 0 }}>
                <div style={sty.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>@{userDetail.user?.username}</h3>
                    <button onClick={() => setSelectedUser(null)} style={sty.btn("rgba(255,255,255,0.08)")}>×</button>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 2 }}>
                    <div>Display: <strong style={{ color: t.text }}>{userDetail.user?.displayName || "—"}</strong></div>
                    <div>Admin: <strong style={{ color: userDetail.user?.isAdmin ? "#ff4444" : t.textMuted }}>{userDetail.user?.isAdmin ? "Yes" : "No"}</strong></div>
                    <div>Races: <strong style={{ color: t.text }}>{userDetail.user?.totalRaces}</strong></div>
                    <div>Wins: <strong style={{ color: "#22cc44" }}>{userDetail.user?.totalWins}</strong></div>
                    <div>Best QM: <strong style={{ color: "#ff8800" }}>{userDetail.user?.bestQmTime ? `${userDetail.user.bestQmTime.toFixed(3)}s` : "—"}</strong></div>
                    <div>Best Speed: <strong style={{ color: "#ff8800" }}>{userDetail.user?.bestQmSpeed ? `${userDetail.user.bestQmSpeed.toFixed(1)} mph` : "—"}</strong></div>
                    <div>Friends: <strong style={{ color: "#2266ff" }}>{userDetail.friends}</strong></div>
                    <div>Cam Profiles: <strong style={{ color: "#eee" }}>{userDetail.camProfiles?.length || 0}</strong></div>
                    <div>Joined: {fmtDate(userDetail.user?.createdAt)}</div>
                    <div>Last Seen: {fmtDate(userDetail.user?.lastSeen)}</div>
                  </div>

                  {/* User's race history */}
                  {userDetail.results?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: "#ff4444", margin: "0 0 8px" }}>Race History</h4>
                      {userDetail.results.slice(0, 10).map((r: RaceResult) => (
                        <div key={r.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
                          <span style={sty.badge(r.isWinner ? "#22cc44" : "#ff4444")}>{r.isWinner ? "WIN" : r.isDnf ? "DNF" : "LOSS"}</span>
                          <span style={{ marginLeft: 8, color: t.text }}>{fmtTime(r.quarterMileTime)}</span>
                          <span style={{ marginLeft: 8, color: t.textMuted }}>@ {r.quarterMileSpeed?.toFixed(1) || "—"} mph</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notifications */}
                  {userDetail.notifications?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: "#2266ff", margin: "0 0 8px" }}>Recent Notifications ({userDetail.notifications.length})</h4>
                      {userDetail.notifications.slice(0, 5).map((n: any) => (
                        <div key={n.id} style={{ padding: "4px 0", fontSize: 10, color: t.textMuted }}>
                          <span style={sty.badge(n.isRead ? "#555" : "#ffaa00")}>{n.type}</span>
                          <span style={{ marginLeft: 6 }}>{n.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RACES TAB */}
        {tab === "races" && (
          <div style={sty.card}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#ff8800" }}>All Races ({races.length})</h3>
            <table style={sty.table}>
              <thead>
                <tr>
                  <th style={sty.th}>Status</th>
                  <th style={sty.th}>Challenger</th>
                  <th style={sty.th}>Opponent</th>
                  <th style={sty.th}>Track</th>
                  <th style={sty.th}>Winner</th>
                  <th style={sty.th}>Created</th>
                  <th style={sty.th}>Finished</th>
                </tr>
              </thead>
              <tbody>
                {races.map(r => (
                  <tr key={r.id}>
                    <td style={sty.td}><span style={sty.badge(statusColor(r.status))}>{r.status}</span></td>
                    <td style={sty.td}>{r.challengerId.slice(0, 8)}...</td>
                    <td style={sty.td}>{r.opponentId.slice(0, 8)}...</td>
                    <td style={sty.td}>{r.trackType}</td>
                    <td style={sty.td}>{r.winnerId ? `${r.winnerId.slice(0, 8)}...` : "—"}</td>
                    <td style={sty.td}>{fmtDate(r.createdAt)}</td>
                    <td style={sty.td}>{r.finishedAt ? fmtDate(r.finishedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div style={sty.card}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#22cc44" }}>All Race Results ({results.length})</h3>
            <table style={sty.table}>
              <thead>
                <tr>
                  <th style={sty.th}>Result</th>
                  <th style={sty.th}>User</th>
                  <th style={sty.th}>QM Time</th>
                  <th style={sty.th}>Speed</th>
                  <th style={sty.th}>60ft</th>
                  <th style={sty.th}>1/8 Mile</th>
                  <th style={sty.th}>Peak HP</th>
                  <th style={sty.th}>Peak TQ</th>
                  <th style={sty.th}>Top Speed</th>
                  <th style={sty.th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td style={sty.td}><span style={sty.badge(r.isWinner ? "#22cc44" : r.isDnf ? "#ff4444" : "#888")}>{r.isWinner ? "WIN" : r.isDnf ? "DNF" : "LOSS"}</span></td>
                    <td style={sty.td}>{r.userId.slice(0, 8)}...</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtTime(r.quarterMileTime)}</td>
                    <td style={sty.td}>{r.quarterMileSpeed?.toFixed(1) || "—"} mph</td>
                    <td style={sty.td}>{fmtTime(r.sixtyFootTime)}</td>
                    <td style={sty.td}>{fmtTime(r.eighthMileTime)}</td>
                    <td style={sty.td}>{r.peakHp?.toFixed(0) || "—"}</td>
                    <td style={sty.td}>{r.peakTorque?.toFixed(0) || "—"}</td>
                    <td style={sty.td}>{r.topSpeedMph?.toFixed(1) || "—"} mph</td>
                    <td style={sty.td}>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* EVENTS TAB */}
        {tab === "events" && (
          <div style={sty.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#ff8800" }}>Admin Event Log ({events.length})</h3>
              <select
                value={eventFilter}
                onChange={e => setEventFilter(e.target.value)}
                style={{ padding: "4px 8px", background: t.inputBg, border: "1px solid " + t.inputBorder, borderRadius: 6, color: t.textMuted, fontSize: 12 }}
              >
                <option value="">All Events</option>
                <option value="user_register">Registrations</option>
                <option value="friend_request">Friend Requests</option>
                <option value="friend_accept">Friend Accepts</option>
                <option value="race_create">Race Created</option>
                <option value="race_countdown">Race Countdown</option>
                <option value="race_finish">Race Finished</option>
                <option value="cam_profile_create">Cam Profile Created</option>
              </select>
              <button onClick={fetchEvents} style={sty.btn("rgba(255,255,255,0.1)")}>Refresh</button>
            </div>
            <table style={sty.table}>
              <thead>
                <tr>
                  <th style={sty.th}>Time</th>
                  <th style={sty.th}>Event Type</th>
                  <th style={sty.th}>Actor</th>
                  <th style={sty.th}>Target</th>
                  <th style={sty.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id}>
                    <td style={sty.td}>{fmtDate(e.createdAt)}</td>
                    <td style={sty.td}><span style={sty.badge(statusColor(e.eventType.includes("race") ? "racing" : e.eventType.includes("friend") ? "accepted" : "pending"))}>{e.eventType}</span></td>
                    <td style={sty.td}>{e.actorId?.slice(0, 12) || "—"}</td>
                    <td style={sty.td}>{e.targetId?.slice(0, 12) || "—"}</td>
                    <td style={{ ...sty.td, fontSize: 10, color: t.textMuted, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {JSON.stringify(e.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ACTION LOGS TAB (from filesystem) */}
        {tab === "logs" && (
          <div style={sty.card}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#2266ff" }}>Action Log Sessions ({actionSessions.length})</h3>
            <p style={{ fontSize: 12, color: t.textDim, marginBottom: 12 }}>
              These are the filesystem-based action logs from client sessions (shift events, stage events, QM runs, etc.)
            </p>
            {actionSessions.length === 0 ? (
              <p style={{ color: t.textDim }}>No sessions found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {actionSessions.map(sid => (
                  <div key={sid} style={{ padding: "6px 10px", borderRadius: 6, background: t.inputBg, fontSize: 13, cursor: "pointer" }}>
                    📁 {sid}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
