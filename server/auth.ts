// ═══════════════════════════════════════════════════════════════════════
// AUTH — Passport-based authentication with bcrypt & optional dev auto-login
// ═══════════════════════════════════════════════════════════════════════

import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { registerUserSchema, type User } from "@shared/schema";
import { log } from "../shared/logger";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const MemoryStoreSession = MemoryStore(session);
const PgSession = connectPgSimple(session);

const BCRYPT_ROUNDS = 12;
const IS_DEV = process.env.NODE_ENV !== "production";

/** Hash a password with bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compare a plaintext password against a bcrypt hash */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Handle legacy SHA-256 hashes (64 hex chars) — migrate on next login
  if (hash.length === 64 && /^[a-f0-9]{64}$/.test(hash)) {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(password).digest("hex") === hash;
  }
  return bcrypt.compare(password, hash);
}

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      displayName: string | null;
      isAdmin: boolean;
    }
  }
}

export function setupAuth(app: Express): void {
  // Session store — use PostgreSQL when available, else MemoryStore
  let sessionStore: session.Store;
  if (pool) {
    try {
      sessionStore = new PgSession({
        pool,
        tableName: "http_sessions",
        createTableIfMissing: true,
      });
      log.info("auth", "Using PostgreSQL session store");
    } catch (e) {
      log.warn("auth", "Failed to create PG session store, falling back to memory", e);
      sessionStore = new MemoryStoreSession({ checkPeriod: 86400000 });
    }
  } else {
    sessionStore = new MemoryStoreSession({ checkPeriod: 86400000 });
    log.info("auth", "Using in-memory session store (no DATABASE_URL)");
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "mono5-dev-secret-key-change-in-prod",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: !IS_DEV, // secure in production (HTTPS required)
      },
    })
  );

  // Passport config
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "User not found" });
        const valid = await verifyPassword(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid password" });

        // Migrate legacy SHA-256 hash to bcrypt on successful login
        if (user.password.length === 64 && /^[a-f0-9]{64}$/.test(user.password)) {
          const newHash = await hashPassword(password);
          await storage.updateUser(user.id, { password: newHash });
          log.info("auth", `Migrated password hash to bcrypt for user: ${user.username}`);
        }

        return done(null, { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin });
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // ── DEV ONLY: Auto-login as admin if not authenticated ────────────
  if (IS_DEV) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        req.user = { id: "admin-dev-001", username: "admin", displayName: "Admin", isAdmin: true };
      }
      next();
    });
    log.info("auth", "Dev auto-login enabled (NODE_ENV !== 'production')");
  }

  // ── AUTH ROUTES ────────────────────────────────────────────────────

  // Register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { username, password, displayName } = parsed.data;

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "Username already taken" });

      const hashedPw = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPw,
        displayName,
      });

      // Auto-login after register
      const sessionUser = { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin };
      req.login(sessionUser, (err) => {
        if (err) return res.status(500).json({ error: "Login failed after registration" });
        log.info("auth", `User registered: ${username}`);
        return res.json({ user: sanitizeUser(user) });
      });
    } catch (err) {
      log.error("auth", "Register error", err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        await storage.setUserOnline(user.id, true);
        log.info("auth", `User logged in: ${user.username}`);
        const fullUser = await storage.getUser(user.id);
        return res.json({ user: fullUser ? sanitizeUser(fullUser) : user });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const userId = req.user?.id;
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      if (userId) storage.setUserOnline(userId, false);
      res.json({ ok: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: sanitizeUser(user) });
  });

  log.info("auth", `Auth system initialized (${IS_DEV ? "dev mode" : "production mode"})`);
}

// Strip password from user objects before sending to client
function sanitizeUser(user: User): Omit<User, "password"> & { password?: never } {
  const { password, ...safe } = user;
  return safe;
}

// Middleware to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// Middleware to require admin
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export { sanitizeUser };
