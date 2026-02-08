import { useState, useEffect } from 'react';

type AiModeListener = (enabled: boolean) => void;

let aiEnabled = false;
const listeners: Set<AiModeListener> = new Set();

export function isAiMode(): boolean {
  return aiEnabled;
}

export function setAiMode(enabled: boolean): void {
  aiEnabled = enabled;
  listeners.forEach(fn => fn(enabled));
}

export function toggleAiMode(): void {
  setAiMode(!aiEnabled);
}

export function onAiModeChange(listener: AiModeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiMode(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(isAiMode());

  useEffect(() => {
    return onAiModeChange(setEnabled);
  }, []);

  return [enabled, toggleAiMode];
}
