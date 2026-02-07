import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      console.error("Heartbeat error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/active-count", async (_req, res) => {
    try {
      const activeCount = await storage.getActiveCount();
      res.json({ activeCount });
    } catch (err) {
      console.error("Active count error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  setInterval(async () => {
    try {
      await storage.cleanupStaleSessions();
    } catch {}
  }, 60_000);

  return httpServer;
}
