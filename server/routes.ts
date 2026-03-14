import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { validatePhysics } from "./aiPhysics";
import { requireAuth, requireAdmin } from "./auth";
import { getActiveRaceCount, getConnectedPlayerCount } from "./raceServer";
import { createCamProfileSchema } from "@shared/schema";
import {
  appendLogs,
  listSessions,
  getSessionLogs,
  getLatestSessionId,
  getQMRunSummary,
  cleanupOldSessions,
} from "./actionLogStorage";
import fs from "fs";
import path from "path";
import { log } from "../shared/logger";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK ENDPOINT — Monitor server status
  // ═══════════════════════════════════════════════════════════════════════════
  const serverStartTime = Date.now();
  app.get("/api/health", async (_req, res) => {
    try {
      const uptimeMs = Date.now() - serverStartTime;
      const memUsage = process.memoryUsage();
      res.json({
        status: "healthy",
        uptime: uptimeMs,
        uptimeHuman: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error('routes', 'Health check error', err);
      res.status(500).json({ status: "unhealthy", error: String(err) });
    }
  });

  app.post("/api/heartbeat", async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "sessionId required" });
      }
      await storage.upsertSession(sessionId);
      const activeCount = await storage.getActiveCount();
      res.json({ activeCount });
    } catch (err) {
      log.error('routes', 'Heartbeat error', err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/active-count", async (_req, res) => {
    try {
      const activeCount = await storage.getActiveCount();
      res.json({ activeCount });
    } catch (err) {
      log.error('routes', 'Active count error', err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/ai-physics", async (req, res) => {
    const defaultCorrections = {
      gripMultiplier: 1.0,
      weightTransferMultiplier: 1.0,
      slipMultiplier: 1.0,
      dragMultiplier: 1.0,
      tractionMultiplier: 1.0,
      aiNotes: "Default values - no AI correction applied.",
    };

    try {
      const {
        rpm, throttle, speedMph, currentGear, torque, horsepower,
        boostPsi, tireSlipPercent, accelerationG, weightTransfer,
        frontAxleLoad, wheelForce, tractionLimit, ecuConfig,
      } = req.body;

      if (rpm == null || ecuConfig == null) {
        return res.status(400).json({ error: "Missing required fields", ...defaultCorrections });
      }

      const result = await validatePhysics({
        rpm, throttle, speedMph, currentGear, torque, horsepower,
        boostPsi, tireSlipPercent, accelerationG, weightTransfer,
        frontAxleLoad, wheelForce, tractionLimit, ecuConfig,
      });

      res.json(result);
    } catch (err) {
      log.error('routes', 'AI physics validation error', err);
      res.json(defaultCorrections);
    }
  });

  app.get("/api/export", async (_req, res) => {
    try {
      const exportPath = path.resolve(import.meta.dirname, "..", "FULL_PROJECT_EXPORT.txt");
      if (!fs.existsSync(exportPath)) {
        return res.status(404).json({ error: "Export file not found" });
      }
      const content = await fs.promises.readFile(exportPath, "utf-8");
      res.json({ content });
    } catch (err) {
      log.error('routes', 'Export error', err);
      res.status(500).json({ error: "Failed to read export" });
    }
  });

  app.get("/api/export/download", async (_req, res) => {
    try {
      const exportPath = path.resolve(import.meta.dirname, "..", "FULL_PROJECT_EXPORT.txt");
      if (!fs.existsSync(exportPath)) {
        return res.status(404).send("Export file not found");
      }
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=FULL_PROJECT_EXPORT.txt");
      const stream = fs.createReadStream(exportPath);
      stream.pipe(res);
    } catch (err) {
      log.error('routes', 'Export download error', err);
      res.status(500).send("Failed to download export");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACTION LOGGING ENDPOINTS — For capturing & reviewing user actions
  // ═══════════════════════════════════════════════════════════════════════

  // POST /api/action-logs — Client sends batches of action log entries
  app.post("/api/action-logs", (req, res) => {
    try {
      const { logs: entries } = req.body;
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "logs array required" });
      }
      appendLogs(entries);
      res.json({ ok: true, count: entries.length });
    } catch (err) {
      log.error('routes', 'Action log write error', err);
      res.status(500).json({ error: "Failed to write logs" });
    }
  });

  // GET /api/action-logs/sessions — List all sessions
  app.get("/api/action-logs/sessions", (_req, res) => {
    try {
      const sessions = listSessions();
      res.json({ sessions });
    } catch (err) {
      log.error('routes', 'Session list error', err);
      res.status(500).json({ error: "Failed to list sessions" });
    }
  });

  // GET /api/action-logs/latest — Get the latest session's logs
  app.get("/api/action-logs/latest", (req, res) => {
    try {
      const latestId = getLatestSessionId();
      if (!latestId) return res.json({ sessionId: null, logs: [] });

      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const event = typeof req.query.event === 'string' ? req.query.event : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : undefined;

      const logs = getSessionLogs(latestId, { type, event, limit });
      res.json({ sessionId: latestId, logs });
    } catch (err) {
      log.error('routes', 'Latest logs error', err);
      res.status(500).json({ error: "Failed to get latest logs" });
    }
  });

  // GET /api/action-logs/:sessionId — Get logs for a specific session
  app.get("/api/action-logs/:sessionId", (req, res) => {
    try {
      const sessionId = String(req.params.sessionId);
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const event = typeof req.query.event === 'string' ? req.query.event : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : undefined;
      const since = typeof req.query.since === 'string' ? parseInt(req.query.since) : undefined;

      const logs = getSessionLogs(sessionId, { type, event, limit, since });
      res.json({ sessionId, entryCount: logs.length, logs });
    } catch (err) {
      log.error('routes', 'Session logs error', err);
      res.status(500).json({ error: "Failed to get session logs" });
    }
  });

  // GET /api/action-logs/:sessionId/qm-runs — Get QM run summaries for a session
  app.get("/api/action-logs/:sessionId/qm-runs", (req, res) => {
    try {
      const sessionId = String(req.params.sessionId);
      const runs = getQMRunSummary(sessionId);
      res.json({ sessionId, runCount: runs.length, runs });
    } catch (err) {
      log.error('routes', 'QM runs error', err);
      res.status(500).json({ error: "Failed to get QM runs" });
    }
  });

  // POST /api/race-telemetry — Save full frame-by-frame race telemetry to file
  app.post("/api/race-telemetry", (req, res) => {
    try {
      const { frames } = req.body;
      if (!Array.isArray(frames) || frames.length === 0) {
        return res.status(400).json({ error: "frames array required" });
      }
      const logPath = path.resolve(process.cwd(), "latest_race_log.json");
      fs.writeFileSync(logPath, JSON.stringify({ timestamp: new Date().toISOString(), frameCount: frames.length, frames }, null, 2));
      log.info('routes', `Race telemetry saved: ${frames.length} frames to ${logPath}`);
      res.json({ ok: true, frameCount: frames.length });
    } catch (err) {
      log.error('routes', 'Race telemetry write error', err);
      res.status(500).json({ error: "Failed to write race telemetry" });
    }
  });

  // DELETE /api/action-logs/cleanup — Clean up old sessions (keep last 20)
  app.delete("/api/action-logs/cleanup", (_req, res) => {
    try {
      const deleted = cleanupOldSessions(20);
      res.json({ deleted });
    } catch (err) {
      log.error('routes', 'Cleanup error', err);
      res.status(500).json({ error: "Failed to cleanup" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // USER ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  // Search users (for adding friends)
  app.get("/api/users/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      if (q.length < 2) return res.json({ users: [] });
      const users = await storage.searchUsers(q);
      res.json({ users: users.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, isOnline: u.isOnline, totalRaces: u.totalRaces, totalWins: u.totalWins })) });
    } catch (err) {
      log.error('routes', 'User search error', err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Get user profile by ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(String(req.params.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...safe } = user;
      res.json({ user: safe });
    } catch (err) {
      log.error('routes', 'User fetch error', err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FRIENDS ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  // Get my friends
  app.get("/api/friends", async (req, res) => {
    try {
      const userId = req.user!.id;
      const friends = await storage.getFriends(userId);
      const pending = await storage.getPendingRequests(userId);
      res.json({
        friends: friends.map(f => ({
          friendshipId: f.id,
          friend: { id: f.friend.id, username: f.friend.username, displayName: f.friend.displayName, isOnline: f.friend.isOnline, totalRaces: f.friend.totalRaces, totalWins: f.friend.totalWins, bestQmTime: f.friend.bestQmTime },
          since: f.updatedAt,
        })),
        pendingRequests: pending.map(p => ({
          friendshipId: p.id,
          requester: { id: p.requester.id, username: p.requester.username, displayName: p.requester.displayName },
          sentAt: p.createdAt,
        })),
      });
    } catch (err) {
      log.error('routes', 'Friends fetch error', err);
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  // Send friend request
  app.post("/api/friends/request", async (req, res) => {
    try {
      const userId = req.user!.id;
      const { addresseeId } = req.body;
      if (!addresseeId) return res.status(400).json({ error: "addresseeId required" });
      if (addresseeId === userId) return res.status(400).json({ error: "Cannot friend yourself" });
      const existing = await storage.getFriendship(userId, addresseeId);
      if (existing) return res.status(409).json({ error: "Friendship already exists", status: existing.status });
      const friendship = await storage.sendFriendRequest(userId, addresseeId);
      res.json({ friendship });
    } catch (err) {
      log.error('routes', 'Friend request error', err);
      res.status(500).json({ error: "Failed to send friend request" });
    }
  });

  // Accept friend request
  app.post("/api/friends/:id/accept", async (req, res) => {
    try {
      const friendship = await storage.acceptFriendRequest(String(req.params.id));
      if (!friendship) return res.status(404).json({ error: "Request not found or already handled" });
      res.json({ friendship });
    } catch (err) {
      log.error('routes', 'Accept friend error', err);
      res.status(500).json({ error: "Failed to accept" });
    }
  });

  // Decline friend request
  app.post("/api/friends/:id/decline", async (req, res) => {
    try {
      await storage.declineFriendRequest(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      log.error('routes', 'Decline friend error', err);
      res.status(500).json({ error: "Failed to decline" });
    }
  });

  // Remove friend
  app.delete("/api/friends/:id", async (req, res) => {
    try {
      await storage.removeFriend(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      log.error('routes', 'Remove friend error', err);
      res.status(500).json({ error: "Failed to remove" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RACE ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  // Challenge someone to a race
  app.post("/api/races/challenge", async (req, res) => {
    try {
      const challengerId = req.user!.id;
      const { opponentId, trackType } = req.body;
      if (!opponentId) return res.status(400).json({ error: "opponentId required" });
      const race = await storage.createRace(challengerId, opponentId, trackType);
      res.json({ race });
    } catch (err) {
      log.error('routes', 'Race challenge error', err);
      res.status(500).json({ error: "Failed to create race" });
    }
  });

  // Accept race challenge
  app.post("/api/races/:id/accept", async (req, res) => {
    try {
      const race = await storage.getRace(String(req.params.id));
      if (!race) return res.status(404).json({ error: "Race not found" });
      if (race.opponentId !== req.user!.id) return res.status(403).json({ error: "Not your race to accept" });
      const updated = await storage.updateRace(String(req.params.id), { status: "accepted" });
      await storage.logEvent({ eventType: "race_accept", actorId: req.user!.id, targetId: String(req.params.id), details: { challengerId: race.challengerId }, ipAddress: null });
      res.json({ race: updated });
    } catch (err) {
      log.error('routes', 'Race accept error', err);
      res.status(500).json({ error: "Failed to accept race" });
    }
  });

  // Decline race challenge
  app.post("/api/races/:id/decline", async (req, res) => {
    try {
      await storage.updateRace(String(req.params.id), { status: "cancelled" });
      res.json({ ok: true });
    } catch (err) {
      log.error('routes', 'Race decline error', err);
      res.status(500).json({ error: "Failed to decline race" });
    }
  });

  // Get my races
  app.get("/api/races", async (req, res) => {
    try {
      const races = await storage.getUserRaces(req.user!.id);
      res.json({ races });
    } catch (err) {
      log.error('routes', 'Races fetch error', err);
      res.status(500).json({ error: "Failed to fetch races" });
    }
  });

  // Get my pending race challenges
  app.get("/api/races/pending", async (req, res) => {
    try {
      const races = await storage.getPendingRacesForUser(req.user!.id);
      res.json({ races });
    } catch (err) {
      log.error('routes', 'Pending races error', err);
      res.status(500).json({ error: "Failed to fetch pending races" });
    }
  });

  // Get race details + results
  app.get("/api/races/:id", async (req, res) => {
    try {
      const race = await storage.getRace(String(req.params.id));
      if (!race) return res.status(404).json({ error: "Race not found" });
      const results = await storage.getRaceResults(String(req.params.id));
      res.json({ race, results });
    } catch (err) {
      log.error('routes', 'Race details error', err);
      res.status(500).json({ error: "Failed to fetch race" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════

  app.get("/api/notifications", async (req, res) => {
    try {
      const unreadOnly = req.query.unreadOnly === "true";
      const notifications = await storage.getUserNotifications(req.user!.id, unreadOnly);
      const unreadCount = await storage.getUnreadCount(req.user!.id);
      res.json({ notifications, unreadCount });
    } catch (err) {
      log.error('routes', 'Notifications error', err);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      await storage.markNotificationRead(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark read" });
    }
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.user!.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark all read" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CUSTOM CAM PROFILES
  // ═══════════════════════════════════════════════════════════════════════

  app.get("/api/cam-profiles", async (req, res) => {
    try {
      const mine = await storage.getUserCamProfiles(req.user!.id);
      const publicProfiles = await storage.getPublicCamProfiles();
      res.json({ profiles: mine, publicProfiles: publicProfiles.filter(p => p.userId !== req.user!.id) });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch cam profiles" });
    }
  });

  app.post("/api/cam-profiles", async (req, res) => {
    try {
      const parsed = createCamProfileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message });
      const profile = await storage.createCamProfile({ ...parsed.data, userId: req.user!.id, intakeLsa: parsed.data.intakeLsa ?? null, exhaustLsa: parsed.data.exhaustLsa ?? null, overlap: parsed.data.overlap ?? null, isPublic: parsed.data.isPublic ?? false, description: parsed.data.description ?? null });
      res.json({ profile });
    } catch (err) {
      res.status(500).json({ error: "Failed to create cam profile" });
    }
  });

  app.delete("/api/cam-profiles/:id", async (req, res) => {
    try {
      await storage.deleteCamProfile(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete cam profile" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES — Full visibility into everything
  // ═══════════════════════════════════════════════════════════════════════

  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    try {
      const [users, races, results, events, activeRaces] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllRaces(),
        storage.getAllRaceResults(),
        storage.getEventLog({ limit: 100 }),
        storage.getActiveRaces(),
      ]);
      const activeCount = await storage.getActiveCount();
      res.json({
        stats: {
          totalUsers: users.length,
          onlineUsers: users.filter(u => u.isOnline).length,
          totalRaces: races.length,
          activeRaces: activeRaces.length,
          completedRaces: races.filter(r => r.status === "finished").length,
          totalResults: results.length,
          eventLogCount: events.length,
          activeSessionCount: activeCount,
          wsRacesActive: getActiveRaceCount(),
          wsPlayersConnected: getConnectedPlayerCount(),
        },
        recentEvents: events.slice(0, 50),
      });
    } catch (err) {
      log.error('routes', 'Admin dashboard error', err);
      res.status(500).json({ error: "Admin dashboard failed" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users: users.map(u => { const { password, ...safe } = u; return safe; }) });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...safe } = user;
      const races = await storage.getUserRaces(id);
      const results = await storage.getUserRaceResults(id);
      const friends = await storage.getFriends(id);
      const camProfiles = await storage.getUserCamProfiles(id);
      const notifications = await storage.getUserNotifications(id);
      res.json({ user: safe, races, results, friends: friends.length, camProfiles, notifications });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user detail" });
    }
  });

  app.get("/api/admin/races", requireAdmin, async (_req, res) => {
    try {
      const races = await storage.getAllRaces();
      res.json({ races });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch races" });
    }
  });

  app.get("/api/admin/races/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const race = await storage.getRace(id);
      if (!race) return res.status(404).json({ error: "Race not found" });
      const results = await storage.getRaceResults(id);
      const challenger = await storage.getUser(race.challengerId);
      const opponent = await storage.getUser(race.opponentId);
      res.json({ race, results, challenger: challenger ? { id: challenger.id, username: challenger.username, displayName: challenger.displayName } : null, opponent: opponent ? { id: opponent.id, username: opponent.username, displayName: opponent.displayName } : null });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch race detail" });
    }
  });

  app.get("/api/admin/event-log", requireAdmin, async (req, res) => {
    try {
      const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 200;
      const events = await storage.getEventLog({ eventType, limit });
      res.json({ events, total: await storage.getEventLogCount() });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch event log" });
    }
  });

  app.get("/api/admin/results", requireAdmin, async (_req, res) => {
    try {
      const results = await storage.getAllRaceResults();
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  setInterval(async () => {
    try {
      await storage.cleanupStaleSessions();
    } catch {}
  }, 60_000);

  return httpServer;
}
