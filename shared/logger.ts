// ═══════════════════════════════════════════════════════════════════════════
// CENTRALIZED LOGGING SYSTEM — Mono5 Engine Simulator
// ═══════════════════════════════════════════════════════════════════════════
// Provides structured, color-coded, filterable logging for both client and
// server. Every log entry includes timestamp, module, level, and optional
// data payload. Logs are also stored in a ring buffer for in-app review.
//
// Usage:
//   import { log } from '@/shared/logger';  // or '../shared/logger'
//   log.info('engineSim', 'RPM updated', { rpm: 7200 });
//   log.warn('3dView',   'WebGL fallback active');
//   log.error('server',  'Route handler failed', error);
//   log.debug('autoTune', 'Iteration 42', { hp: 178 });
//
//   // Get buffered logs for floating panel display:
//   import { getLogBuffer, clearLogBuffer } from '@/shared/logger';
//   const recent = getLogBuffer();   // LogEntry[]
// ═══════════════════════════════════════════════════════════════════════════

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number;        // performance.now() or Date.now()
  iso: string;       // ISO timestamp string
  level: LogLevel;
  module: string;    // e.g. 'engineSim', 'autoTune', '3dView', 'server'
  message: string;
  data?: unknown;
}

// ── Configuration ──────────────────────────────────────────────────────
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Minimum level to emit to console. 'debug' shows everything.
let minLevel: LogLevel = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ? 'info' : 'debug';

// Ring buffer for in-app log viewer (floating panel)
const MAX_BUFFER = 2000;
const buffer: LogEntry[] = [];
let listeners: Array<(entry: LogEntry) => void> = [];

// ── Color codes for terminal / browser console ─────────────────────────
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#888',
  info:  '#4ade80',
  warn:  '#fbbf24',
  error: '#ef4444',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info:  'ℹ️',
  warn:  '⚠️',
  error: '❌',
};

// ── Core log function ──────────────────────────────────────────────────
function emit(level: LogLevel, module: string, message: string, data?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

  const entry: LogEntry = {
    ts: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    iso: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };

  // Push to ring buffer
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  // Notify listeners (for floating panel real-time updates)
  for (const fn of listeners) {
    try { fn(entry); } catch { /* swallow listener errors */ }
  }

  // Console output
  const tag = `[${entry.iso.slice(11, 23)}] ${LEVEL_ICONS[level]} [${module}]`;

  if (typeof window !== 'undefined') {
    // Browser: styled console
    const style = `color:${LEVEL_COLORS[level]};font-weight:${level === 'error' ? 'bold' : 'normal'}`;
    if (data !== undefined) {
      console[level === 'debug' ? 'log' : level](`%c${tag} ${message}`, style, data);
    } else {
      console[level === 'debug' ? 'log' : level](`%c${tag} ${message}`, style);
    }
  } else {
    // Server / Node: plain text
    const line = `${tag} ${message}`;
    if (data !== undefined) {
      console[level === 'debug' ? 'log' : level](line, data);
    } else {
      console[level === 'debug' ? 'log' : level](line);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────
export const log = {
  debug: (module: string, message: string, data?: unknown) => emit('debug', module, message, data),
  info:  (module: string, message: string, data?: unknown) => emit('info',  module, message, data),
  warn:  (module: string, message: string, data?: unknown) => emit('warn',  module, message, data),
  error: (module: string, message: string, data?: unknown) => emit('error', module, message, data),
};

/** Get all buffered log entries (most recent last) */
export function getLogBuffer(): LogEntry[] {
  return [...buffer];
}

/** Clear the log buffer */
export function clearLogBuffer(): void {
  buffer.length = 0;
}

/** Subscribe to new log entries in real-time */
export function onLogEntry(fn: (entry: LogEntry) => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

/** Change the minimum log level at runtime */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
  log.info('logger', `Log level set to ${level}`);
}

/** Get current log level */
export function getLogLevel(): LogLevel {
  return minLevel;
}

// ── Performance timing helper ──────────────────────────────────────────
export function logTiming(module: string, label: string): () => void {
  const start = performance.now();
  return () => {
    const elapsed = performance.now() - start;
    log.debug(module, `${label} took ${elapsed.toFixed(2)}ms`);
  };
}

// ── Error boundary helper ──────────────────────────────────────────────
export function logError(module: string, error: unknown, context?: string): void {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  log.error(module, context ? `${context}: ${msg}` : msg, { stack, error });
}
