import { type User, type InsertUser, activeSessions } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { sql, gt } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertSession(sessionId: string): Promise<void>;
  getActiveCount(): Promise<number>;
  cleanupStaleSessions(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async upsertSession(sessionId: string): Promise<void> {
    await db.insert(activeSessions)
      .values({ sessionId, lastHeartbeat: new Date() })
      .onConflictDoUpdate({
        target: activeSessions.sessionId,
        set: { lastHeartbeat: new Date() },
      });
  }

  async getActiveCount(): Promise<number> {
    const cutoff = new Date(Date.now() - 60_000);
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(activeSessions)
      .where(gt(activeSessions.lastHeartbeat, cutoff));
    return result[0]?.count ?? 0;
  }

  async cleanupStaleSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - 120_000);
    await db.delete(activeSessions)
      .where(sql`${activeSessions.lastHeartbeat} < ${cutoff}`);
  }
}

export const storage = new DatabaseStorage();
