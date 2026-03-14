// ═══════════════════════════════════════════════════════════════════════
// RACE SERVER — WebSocket-based real-time multiplayer racing
// ═══════════════════════════════════════════════════════════════════════
// Protocol:
//   Client → Server: { type: "ready" | "raceUpdate" | "finish", raceId, ... }
//   Server → Client: { type: "countdown" | "go" | "opponentUpdate" | "raceResult", ... }
// ═══════════════════════════════════════════════════════════════════════

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { storage } from "./storage";
import { log } from "../shared/logger";

interface RaceClient {
  ws: WebSocket;
  userId: string;
  username: string;
  raceId: string;
  isReady: boolean;
  lastUpdate: RaceUpdate | null;
  finishData: RaceFinish | null;
}

interface RaceUpdate {
  speedMph: number;
  distanceFt: number;
  rpm: number;
  gear: number;
  elapsedMs: number;
  sixtyFootTime?: number;
  eighthMileTime?: number;
  eighthMileSpeed?: number;
}

interface RaceFinish {
  quarterMileTime: number;
  quarterMileSpeed: number;
  topSpeedMph: number;
  reactionTime: number;
  sixtyFootTime: number;
  eighthMileTime: number;
  eighthMileSpeed: number;
  peakHp: number;
  peakTorque: number;
  vehicleConfig: Record<string, unknown>;
  ecuConfig: Record<string, unknown>;
}

// Active race lobbies: raceId → [client1, client2]
const raceLobbies = new Map<string, RaceClient[]>();
// userId → RaceClient lookup
const clientsByUser = new Map<string, RaceClient>();

let wss: WebSocketServer;

export function setupRaceServer(httpServer: HttpServer): void {
  wss = new WebSocketServer({ server: httpServer, path: "/ws/race" });

  wss.on("connection", (ws, req) => {
    let client: RaceClient | null = null;

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "join":
            client = await handleJoin(ws, msg);
            break;
          case "ready":
            if (client) handleReady(client);
            break;
          case "raceUpdate":
            if (client) handleRaceUpdate(client, msg);
            break;
          case "finish":
            if (client) await handleFinish(client, msg);
            break;
          default:
            ws.send(JSON.stringify({ type: "error", message: `Unknown type: ${msg.type}` }));
        }
      } catch (err) {
        log.error("raceServer", "WS message error", err);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      }
    });

    ws.on("close", () => {
      if (client) handleDisconnect(client);
    });

    ws.on("error", (err) => {
      log.error("raceServer", "WS error", err);
    });
  });

  log.info("raceServer", "WebSocket race server started at /ws/race");
}

async function handleJoin(ws: WebSocket, msg: { raceId: string; userId: string; username: string }): Promise<RaceClient> {
  const { raceId, userId, username } = msg;

  // Clean up old connection if user reconnects
  const existing = clientsByUser.get(userId);
  if (existing) {
    existing.ws.close();
    clientsByUser.delete(userId);
  }

  const client: RaceClient = {
    ws, userId, username, raceId,
    isReady: false, lastUpdate: null, finishData: null,
  };

  clientsByUser.set(userId, client);

  // Add to lobby
  if (!raceLobbies.has(raceId)) raceLobbies.set(raceId, []);
  const lobby = raceLobbies.get(raceId)!;
  lobby.push(client);

  // Notify others in lobby
  const otherClients = lobby.filter(c => c.userId !== userId);
  for (const other of otherClients) {
    sendTo(other, { type: "opponentJoined", username, userId });
  }

  // Send lobby state to joining client
  sendTo(client, {
    type: "joined",
    raceId,
    opponents: otherClients.map(c => ({ userId: c.userId, username: c.username, isReady: c.isReady })),
  });

  log.info("raceServer", `${username} joined race ${raceId}`);
  return client;
}

function handleReady(client: RaceClient): void {
  client.isReady = true;
  const lobby = raceLobbies.get(client.raceId);
  if (!lobby) return;

  // Notify others
  for (const c of lobby) {
    if (c.userId !== client.userId) {
      sendTo(c, { type: "opponentReady", userId: client.userId, username: client.username });
    }
  }

  // Check if all players are ready (need exactly 2)
  if (lobby.length === 2 && lobby.every(c => c.isReady)) {
    startCountdown(client.raceId, lobby);
  }
}

async function startCountdown(raceId: string, lobby: RaceClient[]): Promise<void> {
  log.info("raceServer", `Starting countdown for race ${raceId}`);

  // Update race status
  await storage.updateRace(raceId, { status: "countdown" });
  await storage.logEvent({
    eventType: "race_countdown",
    actorId: null,
    targetId: raceId,
    details: { players: lobby.map(c => c.userId) },
    ipAddress: null,
  });

  // 3-2-1-GO countdown
  const counts = [3, 2, 1];
  for (let i = 0; i < counts.length; i++) {
    setTimeout(() => {
      for (const c of lobby) {
        sendTo(c, { type: "countdown", count: counts[i] });
      }
    }, i * 1000);
  }

  // GO!
  setTimeout(async () => {
    await storage.updateRace(raceId, { status: "racing", startedAt: new Date() });
    for (const c of lobby) {
      sendTo(c, { type: "go", timestamp: Date.now() });
    }
    log.info("raceServer", `Race ${raceId} started!`);
  }, 3000);
}

function handleRaceUpdate(client: RaceClient, msg: RaceUpdate): void {
  client.lastUpdate = msg;
  const lobby = raceLobbies.get(client.raceId);
  if (!lobby) return;

  // Forward update to opponent
  for (const c of lobby) {
    if (c.userId !== client.userId) {
      sendTo(c, {
        type: "opponentUpdate",
        userId: client.userId,
        speedMph: msg.speedMph,
        distanceFt: msg.distanceFt,
        rpm: msg.rpm,
        gear: msg.gear,
        elapsedMs: msg.elapsedMs,
      });
    }
  }
}

async function handleFinish(client: RaceClient, msg: RaceFinish): Promise<void> {
  client.finishData = msg;
  const lobby = raceLobbies.get(client.raceId);
  if (!lobby) return;

  log.info("raceServer", `${client.username} finished race ${client.raceId}: ${msg.quarterMileTime?.toFixed(3)}s @ ${msg.quarterMileSpeed?.toFixed(1)} mph`);

  // Notify opponent that this player finished
  for (const c of lobby) {
    if (c.userId !== client.userId) {
      sendTo(c, {
        type: "opponentFinished",
        userId: client.userId,
        username: client.username,
        quarterMileTime: msg.quarterMileTime,
        quarterMileSpeed: msg.quarterMileSpeed,
      });
    }
  }

  // Check if both players finished
  if (lobby.length === 2 && lobby.every(c => c.finishData)) {
    await resolveRace(client.raceId, lobby);
  }
}

async function resolveRace(raceId: string, lobby: RaceClient[]): Promise<void> {
  const [p1, p2] = lobby;
  const t1 = p1.finishData!.quarterMileTime;
  const t2 = p2.finishData!.quarterMileTime;
  const winner = t1 <= t2 ? p1 : p2;
  const loser = t1 <= t2 ? p2 : p1;

  log.info("raceServer", `Race ${raceId} resolved: WINNER ${winner.username} (${Math.min(t1, t2).toFixed(3)}s) vs ${loser.username} (${Math.max(t1, t2).toFixed(3)}s)`);

  // Store results
  const race = await storage.updateRace(raceId, {
    status: "finished",
    winnerId: winner.userId,
    finishedAt: new Date(),
  });

  for (const c of lobby) {
    const isWinner = c.userId === winner.userId;
    const fd = c.finishData!;
    await storage.addRaceResult({
      raceId,
      userId: c.userId,
      finishTime: fd.quarterMileTime,
      topSpeedMph: fd.topSpeedMph,
      reactionTime: fd.reactionTime,
      sixtyFootTime: fd.sixtyFootTime,
      eighthMileTime: fd.eighthMileTime,
      eighthMileSpeed: fd.eighthMileSpeed,
      quarterMileTime: fd.quarterMileTime,
      quarterMileSpeed: fd.quarterMileSpeed,
      peakHp: fd.peakHp,
      peakTorque: fd.peakTorque,
      vehicleConfig: fd.vehicleConfig,
      ecuConfig: fd.ecuConfig,
      isWinner,
      isDnf: false,
    });
  }

  // Send result to both
  const resultPayload = {
    type: "raceResult" as const,
    raceId,
    winnerId: winner.userId,
    winnerName: winner.username,
    loserId: loser.userId,
    loserName: loser.username,
    winnerTime: winner.finishData!.quarterMileTime,
    winnerSpeed: winner.finishData!.quarterMileSpeed,
    loserTime: loser.finishData!.quarterMileTime,
    loserSpeed: loser.finishData!.quarterMileSpeed,
    margin: Math.abs(t1 - t2),
  };

  for (const c of lobby) {
    sendTo(c, resultPayload);
  }

  // Notifications
  await storage.createNotification({
    userId: winner.userId,
    type: "race_result",
    title: "YOU WON! 🏆",
    message: `You beat ${loser.username} by ${Math.abs(t1 - t2).toFixed(3)}s! (${winner.finishData!.quarterMileTime.toFixed(3)}s @ ${winner.finishData!.quarterMileSpeed.toFixed(1)} mph)`,
    data: resultPayload,
  });

  await storage.createNotification({
    userId: loser.userId,
    type: "race_result",
    title: "Race Complete",
    message: `${winner.username} won by ${Math.abs(t1 - t2).toFixed(3)}s. Your time: ${loser.finishData!.quarterMileTime.toFixed(3)}s @ ${loser.finishData!.quarterMileSpeed.toFixed(1)} mph`,
    data: resultPayload,
  });

  await storage.logEvent({
    eventType: "race_finish",
    actorId: winner.userId,
    targetId: raceId,
    details: resultPayload,
    ipAddress: null,
  });

  // Cleanup lobby after a delay
  setTimeout(() => {
    raceLobbies.delete(raceId);
    for (const c of lobby) clientsByUser.delete(c.userId);
  }, 10_000);
}

function handleDisconnect(client: RaceClient): void {
  log.info("raceServer", `${client.username} disconnected from race ${client.raceId}`);
  clientsByUser.delete(client.userId);
  const lobby = raceLobbies.get(client.raceId);
  if (lobby) {
    const idx = lobby.indexOf(client);
    if (idx !== -1) lobby.splice(idx, 1);
    // Notify remaining players
    for (const c of lobby) {
      sendTo(c, { type: "opponentDisconnected", userId: client.userId, username: client.username });
    }
    if (lobby.length === 0) raceLobbies.delete(client.raceId);
  }
}

function sendTo(client: RaceClient, data: unknown): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

// Expose active race count for admin
export function getActiveRaceCount(): number {
  return raceLobbies.size;
}

export function getConnectedPlayerCount(): number {
  return clientsByUser.size;
}
