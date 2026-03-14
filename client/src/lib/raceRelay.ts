/**
 * Race Relay — BroadcastChannel bridge between Dashboard (sim) ↔ Race Page (WS)
 *
 * The Dashboard sends sim state updates and finish data through the channel.
 * The Race Page receives them and forwards to the WebSocket race server.
 *
 * Flow:
 *   RacePage → sets activeRaceId via setActiveRace()
 *   Dashboard → detects active race, broadcasts raceUpdate/raceFinish via channel
 *   RacePage → listens on channel, sends to WS
 */

const CHANNEL_NAME = "mono5-race-relay";

export interface RaceUpdate {
  type: "raceUpdate";
  speedMph: number;
  distanceFt: number;
  rpm: number;
  gear: number;
  elapsedMs: number;
}

export interface RaceFinishData {
  type: "raceFinish";
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

export interface RaceGoSignal {
  type: "raceGo";
  raceId: string;
}

export interface RaceStopSignal {
  type: "raceStop";
}

export type RaceRelayMessage = RaceUpdate | RaceFinishData | RaceGoSignal | RaceStopSignal;

// Persist active race across tabs via sessionStorage
const RACE_KEY = "mono5-active-race-id";

/** Called by the Race Page when entering a race */
export function setActiveRace(raceId: string | null): void {
  if (raceId) {
    sessionStorage.setItem(RACE_KEY, raceId);
  } else {
    sessionStorage.removeItem(RACE_KEY);
  }
}

/** Called by the Dashboard to check if a race is active */
export function getActiveRace(): string | null {
  return sessionStorage.getItem(RACE_KEY);
}

/** Get a BroadcastChannel (lazily) */
let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel {
  if (!_channel || _channel.name !== CHANNEL_NAME) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return _channel;
}

/** Send a message through the relay channel */
export function relayPost(msg: RaceRelayMessage): void {
  try {
    getChannel().postMessage(msg);
  } catch {
    // BroadcastChannel not supported or closed — silent fail
  }
}

/** Listen for relay messages. Returns cleanup function. */
export function relayListen(handler: (msg: RaceRelayMessage) => void): () => void {
  const ch = getChannel();
  const onMessage = (evt: MessageEvent<RaceRelayMessage>) => handler(evt.data);
  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}
