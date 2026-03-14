import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupRaceServer } from "./raceServer";
import { serveStatic } from "./static";
import { createServer } from "http";
import { log as slog, logError } from "../shared/logger";

// ═══════════════════════════════════════════════════════════════════════════
// CRASH PREVENTION — Keep server alive on errors instead of crashing
// ═══════════════════════════════════════════════════════════════════════════
let errorCount = 0;
let lastErrorTime = 0;
const ERROR_WINDOW_MS = 60000; // 1 minute window
const MAX_ERRORS_IN_WINDOW = 50; // If >50 errors in 1 min, something is very wrong

process.on('uncaughtException', (err: Error) => {
  const now = Date.now();
  if (now - lastErrorTime > ERROR_WINDOW_MS) {
    errorCount = 0; // Reset counter after window passes
  }
  errorCount++;
  lastErrorTime = now;
  
  console.error(`[UNCAUGHT EXCEPTION #${errorCount}]:`, err.message);
  console.error(err.stack);
  logError('server', err, 'Uncaught exception (server kept alive)');
  
  // Only exit if we're getting spammed with errors (indicates catastrophic failure)
  if (errorCount > MAX_ERRORS_IN_WINDOW) {
    console.error('[server] Too many errors in window, exiting to prevent resource exhaustion');
    process.exit(1);
  }
  // Otherwise, keep running — the error is logged and we continue
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[UNHANDLED REJECTION]:', err.message);
  logError('server', err, 'Unhandled promise rejection (server kept alive)');
  // Don't exit — just log. Most unhandled rejections are recoverable.
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Auth must be set up before routes
setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Skip noisy periodic endpoints to keep terminal clean
    if (path.startsWith("/api") && path !== "/api/heartbeat") {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  setupRaceServer(httpServer);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);
    logError('server', err, 'Express error handler');

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      console.log('[server] Vite dev server initialized');
    } catch (e) {
      console.error('[server] FATAL: Vite setup failed:', e);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, () => {
    log(`serving on port ${port}`);
  });

  // Keep the event loop alive — prevent silent exit
  const keepAlive = setInterval(() => {}, 30_000);

  // Keep event loop alive
  httpServer.on('close', () => {
    console.error('[server] HTTP server closed unexpectedly');
    clearInterval(keepAlive);
  });
})();
