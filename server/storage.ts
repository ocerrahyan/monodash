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

// In-memory session tracking for when database is unavailable
const inMemorySessions = new Map<string, number>();

export class DatabaseStorage implements IStorage {
  private users: Map<string, User>;
  private useInMemory: boolean = false;

  constructor() {
    this.users = new Map();
    // Cleanup stale in-memory sessions every 30 seconds
    setInterval(() => this.cleanupInMemorySessions(), 30_000);
  }

  private cleanupInMemorySessions(): void {
    const cutoff = Date.now() - 60_000;
    for (const [id, timestamp] of inMemorySessions) {
      if (timestamp < cutoff) {
        inMemorySessions.delete(id);
      }
    }
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
    // Try database first, fall back to in-memory
    if (!this.useInMemory) {
      try {
        await db.insert(activeSessions)
          .values({ sessionId, lastHeartbeat: new Date() })
          .onConflictDoUpdate({
            target: activeSessions.sessionId,
            set: { lastHeartbeat: new Date() },
          });
        return;
      } catch (err) {
        console.log("Database unavailable, using in-memory session tracking");
        this.useInMemory = true;
      }
    }
    // In-memory fallback
    inMemorySessions.set(sessionId, Date.now());
  }

  async getActiveCount(): Promise<number> {
    if (!this.useInMemory) {
      try {
        const cutoff = new Date(Date.now() - 60_000);
        const result = await db.select({ count: sql<number>`count(*)::int` })
          .from(activeSessions)
          .where(gt(activeSessions.lastHeartbeat, cutoff));
        return result[0]?.count ?? 0;
      } catch (err) {
        this.useInMemory = true;
      }
    }
    // In-memory fallback: count sessions within last 60 seconds
    const cutoff = Date.now() - 60_000;
    let count = 0;
    for (const timestamp of inMemorySessions.values()) {
      if (timestamp > cutoff) count++;
    }
    return count;
  }

  async cleanupStaleSessions(): Promise<void> {
    if (!this.useInMemory) {
      try {
        const cutoff = new Date(Date.now() - 120_000);
        await db.delete(activeSessions)
          .where(sql`${activeSessions.lastHeartbeat} < ${cutoff}`);
        return;
      } catch (err) {
        this.useInMemory = true;
      }
    }
    this.cleanupInMemorySessions();
  }
}

export const storage = new DatabaseStorage();
