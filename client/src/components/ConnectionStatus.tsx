/**
 * ConnectionStatus — Monitors server health and shows reconnection UI
 * 
 * Periodically pings the health endpoint. If the server becomes unreachable,
 * shows a non-blocking overlay encouraging the user to wait or reload.
 * This prevents confusion when the dev server crashes/restarts.
 */

import { useState, useEffect, useCallback } from 'react';
import { log } from '@shared/logger';

interface ConnectionStatusProps {
  /** How often to check health (ms). Default: 10000 (10s) */
  pollInterval?: number;
  /** How many failures before showing the disconnected UI. Default: 2 */
  failureThreshold?: number;
}

export function ConnectionStatus({ 
  pollInterval = 10000,
  failureThreshold = 2 
}: ConnectionStatusProps) {
  const [isConnected, setIsConnected] = useState(true);
  const [failCount, setFailCount] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health', { 
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setIsConnected(true);
        setFailCount(0);
        setLastCheck(new Date());
        if (!isConnected) {
          log.info('connection', 'Server connection restored');
        }
      } else {
        throw new Error(`Health check returned ${response.status}`);
      }
    } catch (err) {
      setFailCount(prev => prev + 1);
      setLastCheck(new Date());
      if (failCount + 1 >= failureThreshold) {
        setIsConnected(false);
        log.warn('connection', 'Server appears to be down', { failCount: failCount + 1 });
      }
    }
  }, [failCount, failureThreshold, isConnected]);

  // Initial check on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Periodic health checks
  useEffect(() => {
    const interval = setInterval(checkHealth, pollInterval);
    return () => clearInterval(interval);
  }, [checkHealth, pollInterval]);

  // Manual retry
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await checkHealth();
    setIsRetrying(false);
  }, [checkHealth]);

  // If connected, render nothing
  if (isConnected) return null;

  // Disconnected UI — non-blocking top banner
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: '#1a1a2e',
        borderBottom: '2px solid #ff6b6b',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: 'JetBrains Mono, monospace',
        color: '#eee',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 16 }}>⚠️</span>
      <span style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 12 }}>
        Server Disconnected
      </span>
      <span style={{ color: '#aaa', fontSize: 11 }}>
        The server appears to be down or restarting.
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          style={{
            padding: '5px 14px',
            background: isRetrying ? '#333' : '#4a4a6a',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: isRetrying ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
        >
          {isRetrying ? 'Checking...' : 'Retry'}
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '5px 14px',
            background: '#2d5a3d',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
        >
          Reload
        </button>
      </div>
      <span style={{ color: '#666', fontSize: 9 }}>
        Failures: {failCount}
      </span>
    </div>
  );
}
