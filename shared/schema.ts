import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  totalRaces: integer("total_races").notNull().default(0),
  totalWins: integer("total_wins").notNull().default(0),
  bestQmTime: real("best_qm_time"),       // seconds
  bestQmSpeed: real("best_qm_speed"),     // mph
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// ACTIVE SESSIONS (heartbeat tracking)
// ═══════════════════════════════════════════════════════════════════════
export const activeSessions = pgTable("active_sessions", {
  sessionId: varchar("session_id").primaryKey(),
  lastHeartbeat: timestamp("last_heartbeat").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// FRIENDSHIPS
// ═══════════════════════════════════════════════════════════════════════
export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  addresseeId: varchar("addressee_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// RACES
// ═══════════════════════════════════════════════════════════════════════
export const races = pgTable("races", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerId: varchar("challenger_id").notNull(),
  opponentId: varchar("opponent_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | countdown | racing | finished | cancelled
  winnerId: varchar("winner_id"),
  trackType: text("track_type").notNull().default("quarter_mile"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

// ═══════════════════════════════════════════════════════════════════════
// RACE RESULTS (one per participant per race)
// ═══════════════════════════════════════════════════════════════════════
export const raceResults = pgTable("race_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raceId: varchar("race_id").notNull(),
  userId: varchar("user_id").notNull(),
  finishTime: real("finish_time"),        // seconds (null if DNF)
  topSpeedMph: real("top_speed_mph"),
  reactionTime: real("reaction_time"),    // seconds
  sixtyFootTime: real("sixty_foot_time"), // seconds
  eighthMileTime: real("eighth_mile_time"),
  eighthMileSpeed: real("eighth_mile_speed"),
  quarterMileTime: real("quarter_mile_time"),
  quarterMileSpeed: real("quarter_mile_speed"),
  peakHp: real("peak_hp"),
  peakTorque: real("peak_torque"),
  vehicleConfig: jsonb("vehicle_config"), // snapshot of their vehicle setup
  ecuConfig: jsonb("ecu_config"),         // snapshot of their ECU tuning
  isWinner: boolean("is_winner").notNull().default(false),
  isDnf: boolean("is_dnf").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// CUSTOM CAM PROFILES
// ═══════════════════════════════════════════════════════════════════════
export const customCamProfiles = pgTable("custom_cam_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  intakeLiftMm: real("intake_lift_mm").notNull(),
  exhaustLiftMm: real("exhaust_lift_mm").notNull(),
  intakeDuration: real("intake_duration").notNull(),
  exhaustDuration: real("exhaust_duration").notNull(),
  intakeLsa: real("intake_lsa"),          // lobe separation angle
  exhaustLsa: real("exhaust_lsa"),
  overlap: real("overlap"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // race_challenge | race_result | friend_request | friend_accepted | system
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),          // flexible payload (raceId, friendId, etc.)
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN EVENT LOG — comprehensive audit trail
// ═══════════════════════════════════════════════════════════════════════
export const adminEventLog = pgTable("admin_event_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // user_register | race_start | race_finish | friend_request | config_change | etc.
  actorId: varchar("actor_id"),           // userId who triggered the event
  targetId: varchar("target_id"),         // affected userId / raceId / etc.
  details: jsonb("details"),              // full event payload
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS & TYPES
// ═══════════════════════════════════════════════════════════════════════

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const registerUserSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only"),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(48).optional(),
});

export const createCamProfileSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  intakeLiftMm: z.number().min(1).max(20),
  exhaustLiftMm: z.number().min(1).max(20),
  intakeDuration: z.number().min(100).max(360),
  exhaustDuration: z.number().min(100).max(360),
  intakeLsa: z.number().min(90).max(130).optional(),
  exhaustLsa: z.number().min(90).max(130).optional(),
  overlap: z.number().min(-30).max(60).optional(),
  isPublic: z.boolean().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type User = typeof users.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type Race = typeof races.$inferSelect;
export type RaceResult = typeof raceResults.$inferSelect;
export type CustomCamProfile = typeof customCamProfiles.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AdminEvent = typeof adminEventLog.$inferSelect;
