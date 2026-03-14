import {
  type User, type Friendship, type Race,
  type RaceResult, type CustomCamProfile, type Notification, type AdminEvent,
  type RegisterUser,
  users, activeSessions, friendships, races, raceResults,
  customCamProfiles, notifications, adminEventLog,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { sql, eq, gt, or, and, desc, ilike, count as drizzleCount } from "drizzle-orm";
import { log } from "../shared/logger";

// ═══════════════════════════════════════════════════════════════════════
// STORAGE INTERFACE
// ═══════════════════════════════════════════════════════════════════════
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: RegisterUser & { isAdmin?: boolean }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  setUserOnline(id: string, online: boolean): Promise<void>;

  // Sessions
  upsertSession(sessionId: string): Promise<void>;
  getActiveCount(): Promise<number>;
  cleanupStaleSessions(): Promise<void>;

  // Friendships
  sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  acceptFriendRequest(friendshipId: string): Promise<Friendship | undefined>;
  declineFriendRequest(friendshipId: string): Promise<void>;
  removeFriend(friendshipId: string): Promise<void>;
  getFriends(userId: string): Promise<(Friendship & { friend: User })[]>;
  getPendingRequests(userId: string): Promise<(Friendship & { requester: User })[]>;
  getFriendship(user1: string, user2: string): Promise<Friendship | undefined>;

  // Races
  createRace(challengerId: string, opponentId: string, trackType?: string): Promise<Race>;
  getRace(id: string): Promise<Race | undefined>;
  updateRace(id: string, updates: Partial<Race>): Promise<Race | undefined>;
  getUserRaces(userId: string): Promise<Race[]>;
  getPendingRacesForUser(userId: string): Promise<Race[]>;
  getActiveRaces(): Promise<Race[]>;
  getAllRaces(): Promise<Race[]>;

  // Race Results
  addRaceResult(result: Omit<RaceResult, "id" | "createdAt">): Promise<RaceResult>;
  getRaceResults(raceId: string): Promise<RaceResult[]>;
  getUserRaceResults(userId: string): Promise<RaceResult[]>;
  getAllRaceResults(): Promise<RaceResult[]>;

  // Custom Cam Profiles
  createCamProfile(profile: Omit<CustomCamProfile, "id" | "createdAt">): Promise<CustomCamProfile>;
  getCamProfile(id: string): Promise<CustomCamProfile | undefined>;
  getUserCamProfiles(userId: string): Promise<CustomCamProfile[]>;
  getPublicCamProfiles(): Promise<CustomCamProfile[]>;
  deleteCamProfile(id: string): Promise<void>;

  // Notifications
  createNotification(notif: Omit<Notification, "id" | "isRead" | "createdAt">): Promise<Notification>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;

  // Admin event log
  logEvent(event: Omit<AdminEvent, "id" | "createdAt">): Promise<AdminEvent>;
  getEventLog(opts?: { eventType?: string; actorId?: string; limit?: number }): Promise<AdminEvent[]>;
  getEventLogCount(): Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════
// IN-MEMORY FALLBACK MAPS — Only used when DATABASE_URL is not set
// ═══════════════════════════════════════════════════════════════════════
const inMemorySessions = new Map<string, number>();

export class DatabaseStorage implements IStorage {
  // In-memory fallback collections (used only when db === null)
  private _users = new Map<string, User>();
  private _friendships = new Map<string, Friendship>();
  private _races = new Map<string, Race>();
  private _raceResults = new Map<string, RaceResult>();
  private _camProfiles = new Map<string, CustomCamProfile>();
  private _notifications = new Map<string, Notification>();
  private _events: AdminEvent[] = [];

  private get hasDb(): boolean { return db !== null; }

  constructor() {
    setInterval(() => this.cleanupInMemorySessions(), 30_000);
    this.seedAdmin();
  }

  /** Seed admin user — always present */
  private async seedAdmin(): Promise<void> {
    const adminId = "admin-dev-001";
    const existing = await this.getUser(adminId);
    if (!existing) {
      const now = new Date();
      const adminUser: User = {
        id: adminId,
        username: "admin",
        password: "", // No password — admin is created via seed only
        displayName: "Admin",
        avatarUrl: null,
        isAdmin: true,
        isOnline: true,
        totalRaces: 0,
        totalWins: 0,
        bestQmTime: null,
        bestQmSpeed: null,
        createdAt: now,
        lastSeen: now,
      };
      if (this.hasDb) {
        try {
          await db!.insert(users).values(adminUser).onConflictDoNothing();
        } catch (e) { log.warn("storage", "DB seed admin failed, using in-memory", e); this._users.set(adminId, adminUser); }
      } else {
        this._users.set(adminId, adminUser);
      }
      log.info("storage", "Admin user seeded");
    }
  }

  private cleanupInMemorySessions(): void {
    const cutoff = Date.now() - 60_000;
    for (const [id, timestamp] of inMemorySessions) {
      if (timestamp < cutoff) inMemorySessions.delete(id);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════════════════════════
  async getUser(id: string): Promise<User | undefined> {
    if (this.hasDb) {
      try {
        const rows = await db!.select().from(users).where(eq(users.id, id)).limit(1);
        return rows[0];
      } catch (e) { log.warn("storage", "DB getUser failed", e); }
    }
    return this._users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (this.hasDb) {
      try {
        const rows = await db!.select().from(users).where(sql`lower(${users.username}) = lower(${username})`).limit(1);
        return rows[0];
      } catch (e) { log.warn("storage", "DB getUserByUsername failed", e); }
    }
    const lower = username.toLowerCase();
    return Array.from(this._users.values()).find(u => u.username.toLowerCase() === lower);
  }

  async createUser(input: RegisterUser & { isAdmin?: boolean }): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      username: input.username,
      password: input.password,
      displayName: input.displayName || input.username,
      avatarUrl: null,
      isAdmin: input.isAdmin ?? false,
      isOnline: false,
      totalRaces: 0,
      totalWins: 0,
      bestQmTime: null,
      bestQmSpeed: null,
      createdAt: now,
      lastSeen: now,
    };
    if (this.hasDb) {
      try {
        const rows = await db!.insert(users).values(user).returning();
        const created = rows[0] ?? user;
        await this.logEvent({ eventType: "user_register", actorId: created.id, targetId: null, details: { username: created.username, displayName: created.displayName }, ipAddress: null });
        return created;
      } catch (e) { log.warn("storage", "DB createUser failed, falling back", e); }
    }
    this._users.set(id, user);
    await this.logEvent({ eventType: "user_register", actorId: id, targetId: null, details: { username: user.username, displayName: user.displayName }, ipAddress: null });
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    // Never allow overwriting the id
    const { id: _discardId, ...safeUpdates } = updates;
    if (this.hasDb) {
      try {
        const rows = await db!.update(users).set(safeUpdates).where(eq(users.id, id)).returning();
        return rows[0];
      } catch (e) { log.warn("storage", "DB updateUser failed", e); }
    }
    const user = this._users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...safeUpdates, id };
    this._users.set(id, updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    if (this.hasDb) {
      try { return await db!.select().from(users); } catch (e) { log.warn("storage", "DB getAllUsers failed", e); }
    }
    return Array.from(this._users.values());
  }

  async searchUsers(query: string): Promise<User[]> {
    if (this.hasDb) {
      try {
        return await db!.select().from(users).where(
          or(ilike(users.username, `%${query}%`), ilike(users.displayName, `%${query}%`))
        );
      } catch (e) { log.warn("storage", "DB searchUsers failed", e); }
    }
    const q = query.toLowerCase();
    return Array.from(this._users.values()).filter(u =>
      u.username.toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q)
    );
  }

  async setUserOnline(id: string, online: boolean): Promise<void> {
    if (this.hasDb) {
      try { await db!.update(users).set({ isOnline: online, lastSeen: new Date() }).where(eq(users.id, id)); return; } catch (e) { log.warn("storage", "DB setUserOnline failed", e); }
    }
    const user = this._users.get(id);
    if (user) { user.isOnline = online; user.lastSeen = new Date(); }
  }

  // ══════════════════════════════════════════════════════════════════
  // SESSIONS (heartbeat)
  // ══════════════════════════════════════════════════════════════════
  async upsertSession(sessionId: string): Promise<void> {
    if (this.hasDb) {
      try {
        await db!.insert(activeSessions)
          .values({ sessionId, lastHeartbeat: new Date() })
          .onConflictDoUpdate({ target: activeSessions.sessionId, set: { lastHeartbeat: new Date() } });
        return;
      } catch (e) { log.warn("storage", "DB upsertSession failed", e); }
    }
    inMemorySessions.set(sessionId, Date.now());
  }

  async getActiveCount(): Promise<number> {
    if (this.hasDb) {
      try {
        const cutoff = new Date(Date.now() - 60_000);
        const result = await db!.select({ count: sql<number>`count(*)::int` })
          .from(activeSessions).where(gt(activeSessions.lastHeartbeat, cutoff));
        return result[0]?.count ?? 0;
      } catch (e) { log.warn("storage", "DB getActiveCount failed", e); }
    }
    const cutoff = Date.now() - 60_000;
    let count = 0;
    for (const ts of inMemorySessions.values()) { if (ts > cutoff) count++; }
    return count;
  }

  async cleanupStaleSessions(): Promise<void> {
    if (this.hasDb) {
      try {
        const cutoff = new Date(Date.now() - 120_000);
        await db!.delete(activeSessions).where(sql`${activeSessions.lastHeartbeat} < ${cutoff}`);
        return;
      } catch (e) { log.warn("storage", "DB cleanupStaleSessions failed", e); }
    }
    this.cleanupInMemorySessions();
  }

  // ══════════════════════════════════════════════════════════════════
  // FRIENDSHIPS
  // ══════════════════════════════════════════════════════════════════
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const id = randomUUID();
    const now = new Date();
    const f: Friendship = { id, requesterId, addresseeId, status: "pending", createdAt: now, updatedAt: now };
    if (this.hasDb) {
      try {
        const rows = await db!.insert(friendships).values(f).returning();
        const created = rows[0] ?? f;
        await this.createNotification({
          userId: addresseeId, type: "friend_request", title: "Friend Request",
          message: `${(await this.getUser(requesterId))?.displayName ?? "Someone"} wants to be your friend!`,
          data: { friendshipId: created.id, requesterId },
        });
        await this.logEvent({ eventType: "friend_request", actorId: requesterId, targetId: addresseeId, details: { friendshipId: created.id }, ipAddress: null });
        return created;
      } catch (e) { log.warn("storage", "DB sendFriendRequest failed", e); }
    }
    this._friendships.set(id, f);
    await this.createNotification({
      userId: addresseeId, type: "friend_request", title: "Friend Request",
      message: `${(await this.getUser(requesterId))?.displayName ?? "Someone"} wants to be your friend!`,
      data: { friendshipId: id, requesterId },
    });
    await this.logEvent({ eventType: "friend_request", actorId: requesterId, targetId: addresseeId, details: { friendshipId: id }, ipAddress: null });
    return f;
  }

  async acceptFriendRequest(friendshipId: string): Promise<Friendship | undefined> {
    if (this.hasDb) {
      try {
        const rows = await db!.update(friendships)
          .set({ status: "accepted", updatedAt: new Date() })
          .where(and(eq(friendships.id, friendshipId), eq(friendships.status, "pending")))
          .returning();
        const f = rows[0];
        if (!f) return undefined;
        await this.createNotification({
          userId: f.requesterId, type: "friend_accepted", title: "Friend Accepted",
          message: `${(await this.getUser(f.addresseeId))?.displayName ?? "Someone"} accepted your friend request!`,
          data: { friendshipId, addresseeId: f.addresseeId },
        });
        await this.logEvent({ eventType: "friend_accept", actorId: f.addresseeId, targetId: f.requesterId, details: { friendshipId }, ipAddress: null });
        return f;
      } catch (e) { log.warn("storage", "DB acceptFriendRequest failed", e); }
    }
    const f = this._friendships.get(friendshipId);
    if (!f || f.status !== "pending") return undefined;
    f.status = "accepted"; f.updatedAt = new Date();
    await this.createNotification({
      userId: f.requesterId, type: "friend_accepted", title: "Friend Accepted",
      message: `${(await this.getUser(f.addresseeId))?.displayName ?? "Someone"} accepted your friend request!`,
      data: { friendshipId, addresseeId: f.addresseeId },
    });
    await this.logEvent({ eventType: "friend_accept", actorId: f.addresseeId, targetId: f.requesterId, details: { friendshipId }, ipAddress: null });
    return f;
  }

  async declineFriendRequest(friendshipId: string): Promise<void> {
    if (this.hasDb) {
      try { await db!.update(friendships).set({ status: "declined", updatedAt: new Date() }).where(eq(friendships.id, friendshipId)); return; } catch (e) { log.warn("storage", "DB declineFriendRequest failed", e); }
    }
    const f = this._friendships.get(friendshipId);
    if (f) { f.status = "declined"; f.updatedAt = new Date(); }
  }

  async removeFriend(friendshipId: string): Promise<void> {
    if (this.hasDb) {
      try { await db!.delete(friendships).where(eq(friendships.id, friendshipId)); return; } catch (e) { log.warn("storage", "DB removeFriend failed", e); }
    }
    this._friendships.delete(friendshipId);
  }

  async getFriends(userId: string): Promise<(Friendship & { friend: User })[]> {
    if (this.hasDb) {
      try {
        const rows = await db!.select().from(friendships).where(
          and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)))
        );
        const result: (Friendship & { friend: User })[] = [];
        for (const f of rows) {
          const friendId = f.requesterId === userId ? f.addresseeId : f.requesterId;
          const friend = await this.getUser(friendId);
          if (friend) result.push({ ...f, friend });
        }
        return result;
      } catch (e) { log.warn("storage", "DB getFriends failed", e); }
    }
    const result: (Friendship & { friend: User })[] = [];
    for (const f of this._friendships.values()) {
      if (f.status !== "accepted") continue;
      let friendId: string | null = null;
      if (f.requesterId === userId) friendId = f.addresseeId;
      else if (f.addresseeId === userId) friendId = f.requesterId;
      if (friendId) {
        const friend = this._users.get(friendId);
        if (friend) result.push({ ...f, friend });
      }
    }
    return result;
  }

  async getPendingRequests(userId: string): Promise<(Friendship & { requester: User })[]> {
    if (this.hasDb) {
      try {
        const rows = await db!.select().from(friendships).where(
          and(eq(friendships.status, "pending"), eq(friendships.addresseeId, userId))
        );
        const result: (Friendship & { requester: User })[] = [];
        for (const f of rows) {
          const requester = await this.getUser(f.requesterId);
          if (requester) result.push({ ...f, requester });
        }
        return result;
      } catch (e) { log.warn("storage", "DB getPendingRequests failed", e); }
    }
    const result: (Friendship & { requester: User })[] = [];
    for (const f of this._friendships.values()) {
      if (f.status === "pending" && f.addresseeId === userId) {
        const requester = this._users.get(f.requesterId);
        if (requester) result.push({ ...f, requester });
      }
    }
    return result;
  }

  async getFriendship(user1: string, user2: string): Promise<Friendship | undefined> {
    if (this.hasDb) {
      try {
        const rows = await db!.select().from(friendships).where(
          or(
            and(eq(friendships.requesterId, user1), eq(friendships.addresseeId, user2)),
            and(eq(friendships.requesterId, user2), eq(friendships.addresseeId, user1)),
          )
        ).limit(1);
        return rows[0];
      } catch (e) { log.warn("storage", "DB getFriendship failed", e); }
    }
    for (const f of this._friendships.values()) {
      if ((f.requesterId === user1 && f.addresseeId === user2) ||
          (f.requesterId === user2 && f.addresseeId === user1)) return f;
    }
    return undefined;
  }

  // ══════════════════════════════════════════════════════════════════
  // RACES
  // ══════════════════════════════════════════════════════════════════
  async createRace(challengerId: string, opponentId: string, trackType = "quarter_mile"): Promise<Race> {
    const id = randomUUID();
    const now = new Date();
    const race: Race = { id, challengerId, opponentId, status: "pending", winnerId: null, trackType, createdAt: now, startedAt: null, finishedAt: null };
    if (this.hasDb) {
      try {
        const rows = await db!.insert(races).values(race).returning();
        const created = rows[0] ?? race;
        await this.createNotification({
          userId: opponentId, type: "race_challenge", title: "Race Challenge!",
          message: `${(await this.getUser(challengerId))?.displayName ?? "Someone"} challenges you to a ${trackType.replace("_", " ")} race!`,
          data: { raceId: created.id, challengerId },
        });
        await this.logEvent({ eventType: "race_create", actorId: challengerId, targetId: opponentId, details: { raceId: created.id, trackType }, ipAddress: null });
        return created;
      } catch (e) { log.warn("storage", "DB createRace failed", e); }
    }
    this._races.set(id, race);
    await this.createNotification({
      userId: opponentId, type: "race_challenge", title: "Race Challenge!",
      message: `${(await this.getUser(challengerId))?.displayName ?? "Someone"} challenges you to a ${trackType.replace("_", " ")} race!`,
      data: { raceId: id, challengerId },
    });
    await this.logEvent({ eventType: "race_create", actorId: challengerId, targetId: opponentId, details: { raceId: id, trackType }, ipAddress: null });
    return race;
  }

  async getRace(id: string): Promise<Race | undefined> {
    if (this.hasDb) {
      try { const rows = await db!.select().from(races).where(eq(races.id, id)).limit(1); return rows[0]; } catch (e) { log.warn("storage", "DB getRace failed", e); }
    }
    return this._races.get(id);
  }

  async updateRace(id: string, updates: Partial<Race>): Promise<Race | undefined> {
    const { id: _discardId, ...safeUpdates } = updates;
    if (this.hasDb) {
      try { const rows = await db!.update(races).set(safeUpdates).where(eq(races.id, id)).returning(); return rows[0]; } catch (e) { log.warn("storage", "DB updateRace failed", e); }
    }
    const race = this._races.get(id);
    if (!race) return undefined;
    Object.assign(race, safeUpdates);
    return race;
  }

  async getUserRaces(userId: string): Promise<Race[]> {
    if (this.hasDb) {
      try {
        return await db!.select().from(races).where(or(eq(races.challengerId, userId), eq(races.opponentId, userId))).orderBy(desc(races.createdAt));
      } catch (e) { log.warn("storage", "DB getUserRaces failed", e); }
    }
    return Array.from(this._races.values()).filter(r => r.challengerId === userId || r.opponentId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPendingRacesForUser(userId: string): Promise<Race[]> {
    if (this.hasDb) {
      try {
        return await db!.select().from(races).where(and(eq(races.opponentId, userId), eq(races.status, "pending")));
      } catch (e) { log.warn("storage", "DB getPendingRacesForUser failed", e); }
    }
    return Array.from(this._races.values()).filter(r => r.opponentId === userId && r.status === "pending");
  }

  async getActiveRaces(): Promise<Race[]> {
    if (this.hasDb) {
      try {
        return await db!.select().from(races).where(or(eq(races.status, "racing"), eq(races.status, "countdown")));
      } catch (e) { log.warn("storage", "DB getActiveRaces failed", e); }
    }
    return Array.from(this._races.values()).filter(r => r.status === "racing" || r.status === "countdown");
  }

  async getAllRaces(): Promise<Race[]> {
    if (this.hasDb) {
      try { return await db!.select().from(races).orderBy(desc(races.createdAt)); } catch (e) { log.warn("storage", "DB getAllRaces failed", e); }
    }
    return Array.from(this._races.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ══════════════════════════════════════════════════════════════════
  // RACE RESULTS
  // ══════════════════════════════════════════════════════════════════
  async addRaceResult(input: Omit<RaceResult, "id" | "createdAt">): Promise<RaceResult> {
    const id = randomUUID();
    const result: RaceResult = { ...input, id, createdAt: new Date() };
    if (this.hasDb) {
      try {
        const rows = await db!.insert(raceResults).values(result).returning();
        const created = rows[0] ?? result;
        // Update user stats
        const user = await this.getUser(input.userId);
        if (user) {
          const statUpdates: Partial<User> = { totalRaces: (user.totalRaces ?? 0) + 1 };
          if (input.isWinner) statUpdates.totalWins = (user.totalWins ?? 0) + 1;
          if (input.quarterMileTime && (!user.bestQmTime || input.quarterMileTime < user.bestQmTime)) statUpdates.bestQmTime = input.quarterMileTime;
          if (input.quarterMileSpeed && (!user.bestQmSpeed || input.quarterMileSpeed > user.bestQmSpeed)) statUpdates.bestQmSpeed = input.quarterMileSpeed;
          await this.updateUser(user.id, statUpdates);
        }
        return created;
      } catch (e) { log.warn("storage", "DB addRaceResult failed", e); }
    }
    this._raceResults.set(id, result);
    const user = this._users.get(input.userId);
    if (user) {
      user.totalRaces = (user.totalRaces ?? 0) + 1;
      if (input.isWinner) user.totalWins = (user.totalWins ?? 0) + 1;
      if (input.quarterMileTime && (!user.bestQmTime || input.quarterMileTime < user.bestQmTime)) user.bestQmTime = input.quarterMileTime;
      if (input.quarterMileSpeed && (!user.bestQmSpeed || input.quarterMileSpeed > user.bestQmSpeed)) user.bestQmSpeed = input.quarterMileSpeed;
    }
    return result;
  }

  async getRaceResults(raceId: string): Promise<RaceResult[]> {
    if (this.hasDb) {
      try { return await db!.select().from(raceResults).where(eq(raceResults.raceId, raceId)); } catch (e) { log.warn("storage", "DB getRaceResults failed", e); }
    }
    return Array.from(this._raceResults.values()).filter(r => r.raceId === raceId);
  }

  async getUserRaceResults(userId: string): Promise<RaceResult[]> {
    if (this.hasDb) {
      try { return await db!.select().from(raceResults).where(eq(raceResults.userId, userId)).orderBy(desc(raceResults.createdAt)); } catch (e) { log.warn("storage", "DB getUserRaceResults failed", e); }
    }
    return Array.from(this._raceResults.values()).filter(r => r.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllRaceResults(): Promise<RaceResult[]> {
    if (this.hasDb) {
      try { return await db!.select().from(raceResults).orderBy(desc(raceResults.createdAt)); } catch (e) { log.warn("storage", "DB getAllRaceResults failed", e); }
    }
    return Array.from(this._raceResults.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ══════════════════════════════════════════════════════════════════
  // CUSTOM CAM PROFILES
  // ══════════════════════════════════════════════════════════════════
  async createCamProfile(input: Omit<CustomCamProfile, "id" | "createdAt">): Promise<CustomCamProfile> {
    const id = randomUUID();
    const profile: CustomCamProfile = { ...input, id, createdAt: new Date() };
    if (this.hasDb) {
      try {
        const rows = await db!.insert(customCamProfiles).values(profile).returning();
        const created = rows[0] ?? profile;
        await this.logEvent({ eventType: "cam_profile_create", actorId: input.userId, targetId: null, details: { profileId: created.id, name: input.name }, ipAddress: null });
        return created;
      } catch (e) { log.warn("storage", "DB createCamProfile failed", e); }
    }
    this._camProfiles.set(id, profile);
    await this.logEvent({ eventType: "cam_profile_create", actorId: input.userId, targetId: null, details: { profileId: id, name: input.name }, ipAddress: null });
    return profile;
  }

  async getCamProfile(id: string): Promise<CustomCamProfile | undefined> {
    if (this.hasDb) {
      try { const rows = await db!.select().from(customCamProfiles).where(eq(customCamProfiles.id, id)).limit(1); return rows[0]; } catch (e) { log.warn("storage", "DB getCamProfile failed", e); }
    }
    return this._camProfiles.get(id);
  }

  async getUserCamProfiles(userId: string): Promise<CustomCamProfile[]> {
    if (this.hasDb) {
      try { return await db!.select().from(customCamProfiles).where(eq(customCamProfiles.userId, userId)); } catch (e) { log.warn("storage", "DB getUserCamProfiles failed", e); }
    }
    return Array.from(this._camProfiles.values()).filter(p => p.userId === userId);
  }

  async getPublicCamProfiles(): Promise<CustomCamProfile[]> {
    if (this.hasDb) {
      try { return await db!.select().from(customCamProfiles).where(eq(customCamProfiles.isPublic, true)); } catch (e) { log.warn("storage", "DB getPublicCamProfiles failed", e); }
    }
    return Array.from(this._camProfiles.values()).filter(p => p.isPublic);
  }

  async deleteCamProfile(id: string): Promise<void> {
    if (this.hasDb) {
      try { await db!.delete(customCamProfiles).where(eq(customCamProfiles.id, id)); return; } catch (e) { log.warn("storage", "DB deleteCamProfile failed", e); }
    }
    this._camProfiles.delete(id);
  }

  // ══════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════
  async createNotification(input: Omit<Notification, "id" | "isRead" | "createdAt">): Promise<Notification> {
    const id = randomUUID();
    const notif: Notification = { ...input, id, isRead: false, createdAt: new Date() };
    if (this.hasDb) {
      try { const rows = await db!.insert(notifications).values(notif).returning(); return rows[0] ?? notif; } catch (e) { log.warn("storage", "DB createNotification failed", e); }
    }
    this._notifications.set(id, notif);
    return notif;
  }

  async getUserNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
    if (this.hasDb) {
      try {
        const conds = [eq(notifications.userId, userId)];
        if (unreadOnly) conds.push(eq(notifications.isRead, false));
        return await db!.select().from(notifications).where(and(...conds)).orderBy(desc(notifications.createdAt));
      } catch (e) { log.warn("storage", "DB getUserNotifications failed", e); }
    }
    return Array.from(this._notifications.values())
      .filter(n => n.userId === userId && (!unreadOnly || !n.isRead))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markNotificationRead(id: string): Promise<void> {
    if (this.hasDb) {
      try { await db!.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)); return; } catch (e) { log.warn("storage", "DB markNotificationRead failed", e); }
    }
    const n = this._notifications.get(id); if (n) n.isRead = true;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (this.hasDb) {
      try { await db!.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId)); return; } catch (e) { log.warn("storage", "DB markAllNotificationsRead failed", e); }
    }
    for (const n of this._notifications.values()) { if (n.userId === userId) n.isRead = true; }
  }

  async getUnreadCount(userId: string): Promise<number> {
    if (this.hasDb) {
      try {
        const result = await db!.select({ count: sql<number>`count(*)::int` }).from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
        return result[0]?.count ?? 0;
      } catch (e) { log.warn("storage", "DB getUnreadCount failed", e); }
    }
    let count = 0;
    for (const n of this._notifications.values()) { if (n.userId === userId && !n.isRead) count++; }
    return count;
  }

  // ══════════════════════════════════════════════════════════════════
  // ADMIN EVENT LOG
  // ══════════════════════════════════════════════════════════════════
  async logEvent(input: Omit<AdminEvent, "id" | "createdAt">): Promise<AdminEvent> {
    const event: AdminEvent = { ...input, id: randomUUID(), createdAt: new Date() };
    if (this.hasDb) {
      try { const rows = await db!.insert(adminEventLog).values(event).returning(); return rows[0] ?? event; } catch (e) { log.warn("storage", "DB logEvent failed", e); }
    }
    this._events.push(event);
    return event;
  }

  async getEventLog(opts?: { eventType?: string; actorId?: string; limit?: number }): Promise<AdminEvent[]> {
    if (this.hasDb) {
      try {
        const conds: ReturnType<typeof eq>[] = [];
        if (opts?.eventType) conds.push(eq(adminEventLog.eventType, opts.eventType));
        if (opts?.actorId) conds.push(eq(adminEventLog.actorId, opts.actorId));
        let query = db!.select().from(adminEventLog);
        if (conds.length) query = query.where(and(...conds)) as typeof query;
        const rows = await query.orderBy(desc(adminEventLog.createdAt)).limit(opts?.limit ?? 500);
        return rows;
      } catch (e) { log.warn("storage", "DB getEventLog failed", e); }
    }
    let events = [...this._events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (opts?.eventType) events = events.filter(e => e.eventType === opts.eventType);
    if (opts?.actorId) events = events.filter(e => e.actorId === opts.actorId);
    if (opts?.limit) events = events.slice(0, opts.limit);
    return events;
  }

  async getEventLogCount(): Promise<number> {
    if (this.hasDb) {
      try {
        const result = await db!.select({ count: sql<number>`count(*)::int` }).from(adminEventLog);
        return result[0]?.count ?? 0;
      } catch (e) { log.warn("storage", "DB getEventLogCount failed", e); }
    }
    return this._events.length;
  }
}

export const storage = new DatabaseStorage();
