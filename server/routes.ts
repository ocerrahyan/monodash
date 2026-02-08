import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { validatePhysics } from "./aiPhysics";
import fs from "fs";
import path from "path";

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

  app.get("/api/export", async (_req, res) => {
    try {
      const exportPath = path.resolve(import.meta.dirname, "..", "FULL_PROJECT_EXPORT.txt");
      if (!fs.existsSync(exportPath)) {
        return res.status(404).json({ error: "Export file not found" });
      }
      const content = await fs.promises.readFile(exportPath, "utf-8");
      res.json({ content });
    } catch (err) {
      console.error("Export error:", err);
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
      console.error("Export download error:", err);
      res.status(500).send("Failed to download export");
    }
  });

  setInterval(async () => {
    try {
      await storage.cleanupStaleSessions();
    } catch {}
  }, 60_000);

  return httpServer;
}
