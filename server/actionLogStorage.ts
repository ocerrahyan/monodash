// ═══════════════════════════════════════════════════════════════════════════
// ACTION LOG STORAGE — Server-side persistent log storage & retrieval
// ═══════════════════════════════════════════════════════════════════════════
// Stores action logs as JSON files organized by session.
// Each session gets its own file: logs/session_<sessionId>.json
// Provides query API for the agent to review and troubleshoot.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { log } from '../shared/logger';

const LOGS_DIR = path.resolve(import.meta.dirname, '..', 'action-logs');

// Ensure logs directory exists
function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    log.info('actionLogStorage', `Created logs directory: ${LOGS_DIR}`);
  }
}

interface ActionLogEntry {
  id: string;
  timestamp: number;
  isoTime: string;
  sessionId: string;
  type: string;
  event: string;
  data: Record<string, unknown>;
  simState?: Record<string, unknown>;
}

// ── Write logs ─────────────────────────────────────────────────────────

/**
 * Append log entries to the session's log file.
 * Creates the file if it doesn't exist.
 */
export function appendLogs(entries: ActionLogEntry[]): void {
  ensureLogsDir();

  // Group entries by session
  const bySession = new Map<string, ActionLogEntry[]>();
  for (const entry of entries) {
    const sid = entry.sessionId || 'unknown';
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid)!.push(entry);
  }

  for (const [sessionId, sessionEntries] of Array.from(bySession.entries())) {
    const filePath = path.join(LOGS_DIR, `session_${sessionId}.json`);

    let existing: ActionLogEntry[] = [];
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        existing = JSON.parse(raw);
      } catch {
        log.warn('actionLogStorage', `Corrupt log file, starting fresh: ${filePath}`);
        existing = [];
      }
    }

    existing.push(...sessionEntries);
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
    log.debug('actionLogStorage', `Wrote ${sessionEntries.length} entries to ${sessionId} (total: ${existing.length})`);
  }
}

// ── Read logs ──────────────────────────────────────────────────────────

/**
 * Get all available session IDs, sorted newest first
 */
export function listSessions(): Array<{
  sessionId: string;
  entryCount: number;
  firstEntry: string;
  lastEntry: string;
  fileSize: number;
}> {
  ensureLogsDir();

  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.startsWith('session_') && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.map(f => {
    const filePath = path.join(LOGS_DIR, f);
    const stat = fs.statSync(filePath);
    let entryCount = 0;
    let firstEntry = '';
    let lastEntry = '';

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entries: ActionLogEntry[] = JSON.parse(raw);
      entryCount = entries.length;
      if (entries.length > 0) {
        firstEntry = entries[0].isoTime;
        lastEntry = entries[entries.length - 1].isoTime;
      }
    } catch {}

    return {
      sessionId: f.replace('session_', '').replace('.json', ''),
      entryCount,
      firstEntry,
      lastEntry,
      fileSize: stat.size,
    };
  });
}

/**
 * Get logs for a specific session, with optional filters
 */
export function getSessionLogs(
  sessionId: string,
  filters?: {
    type?: string;
    event?: string;
    limit?: number;
    since?: number;  // timestamp
  }
): ActionLogEntry[] {
  ensureLogsDir();

  const filePath = path.join(LOGS_DIR, `session_${sessionId}.json`);
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    let entries: ActionLogEntry[] = JSON.parse(raw);

    if (filters?.type) {
      entries = entries.filter(e => e.type === filters.type);
    }
    if (filters?.event) {
      entries = entries.filter(e => e.event.toLowerCase().includes(filters.event!.toLowerCase()));
    }
    if (filters?.since) {
      entries = entries.filter(e => e.timestamp >= filters.since!);
    }
    if (filters?.limit) {
      entries = entries.slice(-filters.limit);
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Get the latest session ID
 */
export function getLatestSessionId(): string | null {
  const sessions = listSessions();
  return sessions.length > 0 ? sessions[0].sessionId : null;
}

/**
 * Get a summary of a session's QM runs (for quick agent review)
 */
export function getQMRunSummary(sessionId: string): Array<{
  startTime: string;
  finishTime: string;
  et: number;
  trapSpeedMph: number;
  splits: Record<string, unknown>;
  configAtStart: Record<string, unknown> | null;
}> {
  const logs = getSessionLogs(sessionId);
  const runs: Array<{
    startTime: string;
    finishTime: string;
    et: number;
    trapSpeedMph: number;
    splits: Record<string, unknown>;
    configAtStart: Record<string, unknown> | null;
  }> = [];

  let currentRunConfig: Record<string, unknown> | null = null;

  for (const entry of logs) {
    if (entry.type === 'qm_start') {
      currentRunConfig = entry.data.config as Record<string, unknown> || null;
    }
    if (entry.type === 'qm_finish') {
      runs.push({
        startTime: logs.find(l => l.type === 'qm_start' && l.timestamp <= entry.timestamp)?.isoTime || '',
        finishTime: entry.isoTime,
        et: entry.data.et as number,
        trapSpeedMph: entry.data.trapSpeedMph as number,
        splits: entry.data.splits as Record<string, unknown> || {},
        configAtStart: currentRunConfig,
      });
    }
  }

  return runs;
}

/**
 * Delete old sessions (keep last N)
 */
export function cleanupOldSessions(keepCount: number = 20): number {
  ensureLogsDir();

  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.startsWith('session_') && f.endsWith('.json'))
    .sort()
    .reverse();

  let deleted = 0;
  if (files.length > keepCount) {
    for (const f of files.slice(keepCount)) {
      try {
        fs.unlinkSync(path.join(LOGS_DIR, f));
        deleted++;
      } catch {}
    }
  }

  return deleted;
}
