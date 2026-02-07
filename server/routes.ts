import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { validatePhysics } from "./aiPhysics";

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
      console.error("AI physics validation error:", err);
      res.json(defaultCorrections);
    }
  });

  setInterval(async () => {
    try {
      await storage.cleanupStaleSessions();
    } catch {}
  }, 60_000);

  return httpServer;
}
