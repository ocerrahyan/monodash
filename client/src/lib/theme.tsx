import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL THEME SYSTEM — shared across ALL pages
// ═══════════════════════════════════════════════════════════════════════════

export type ThemeMode = 'dark' | 'grey' | 'light';

export interface ThemeColors {
  /** Page background */
  bg: string;
  /** Primary text color */
  text: string;
  /** Muted / secondary text */
  textMuted: string;
  /** Very dim text (labels, hints) */
  textDim: string;
  /** Border color for sections, dividers */
  border: string;
  /** Faint border (row separators) */
  borderFaint: string;
  /** Input / button background */
  inputBg: string;
  /** Input / button border */
  inputBorder: string;
  /** Input text */
  inputText: string;
  /** Select dropdown bg */
  selectBg: string;
  /** Active/selected option border */
  activeBorder: string;
  /** Active option text */
  activeText: string;
  /** Inactive option text */
  inactiveText: string;
  /** Inactive option border */
  inactiveBorder: string;
  /** Accent for the VEHICLE label */
  accent: string;
  /** Nav bar bg */
  navBg: string;
  /** Bottom bar bg */
  bottomBg: string;
  /** Toggle / button highlight */
  btnHover: string;
  /** Card / panel background (for pages with cards) */
  cardBg: string;
  /** Card border */
  cardBorder: string;
}

export const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: '#0f1419',
    text: '#e6edf3',
    textMuted: 'rgba(230,237,243,0.75)',
    textDim: 'rgba(230,237,243,0.4)',
    border: 'rgba(48,54,61,0.8)',
    borderFaint: 'rgba(48,54,61,0.4)',
    inputBg: '#161b22',
    inputBorder: 'rgba(48,54,61,0.9)',
    inputText: '#e6edf3',
    selectBg: '#161b22',
    activeBorder: '#00b4d8',
    activeText: '#00b4d8',
    inactiveText: 'rgba(230,237,243,0.4)',
    inactiveBorder: 'rgba(48,54,61,0.6)',
    accent: '#00b4d8',
    navBg: '#0d1117',
    bottomBg: '#0d1117',
    btnHover: 'rgba(0,180,216,0.12)',
    cardBg: 'rgba(22,27,34,0.6)',
    cardBorder: 'rgba(48,54,61,0.6)',
  },
  grey: {
    bg: '#1a2332',
    text: '#d0d7de',
    textMuted: 'rgba(208,215,222,0.75)',
    textDim: 'rgba(208,215,222,0.4)',
    border: 'rgba(68,76,86,0.7)',
    borderFaint: 'rgba(68,76,86,0.35)',
    inputBg: '#22303f',
    inputBorder: 'rgba(68,76,86,0.8)',
    inputText: '#d0d7de',
    selectBg: '#22303f',
    activeBorder: '#00b4d8',
    activeText: '#00b4d8',
    inactiveText: 'rgba(208,215,222,0.4)',
    inactiveBorder: 'rgba(68,76,86,0.5)',
    accent: '#00b4d8',
    navBg: '#141d26',
    bottomBg: '#141d26',
    btnHover: 'rgba(0,180,216,0.12)',
    cardBg: 'rgba(34,48,63,0.5)',
    cardBorder: 'rgba(68,76,86,0.5)',
  },
  light: {
    bg: '#f1f5f9',
    text: '#1e293b',
    textMuted: 'rgba(30,41,59,0.7)',
    textDim: 'rgba(30,41,59,0.4)',
    border: 'rgba(30,41,59,0.15)',
    borderFaint: 'rgba(30,41,59,0.08)',
    inputBg: '#ffffff',
    inputBorder: 'rgba(30,41,59,0.2)',
    inputText: '#1e293b',
    selectBg: '#ffffff',
    activeBorder: '#0284c7',
    activeText: '#0284c7',
    inactiveText: 'rgba(30,41,59,0.4)',
    inactiveBorder: 'rgba(30,41,59,0.15)',
    accent: '#0284c7',
    navBg: '#e2e8f0',
    bottomBg: '#e2e8f0',
    btnHover: 'rgba(2,132,199,0.08)',
    cardBg: 'rgba(255,255,255,0.8)',
    cardBorder: 'rgba(30,41,59,0.12)',
  },
};

export const THEME_ORDER: ThemeMode[] = ['dark', 'grey', 'light'];
export const THEME_ICONS: Record<ThemeMode, string> = { dark: '◐', grey: '◑', light: '○' };

// ── Context ──
interface ThemeContextValue {
  theme: ThemeColors;
  themeMode: ThemeMode;
  cycleTheme: () => void;
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: THEMES.grey,
  themeMode: 'grey',
  cycleTheme: () => {},
});

export function useTheme(): ThemeColors {
  return useContext(ThemeCtx).theme;
}

export function useThemeMode(): [ThemeMode, () => void] {
  const ctx = useContext(ThemeCtx);
  return [ctx.themeMode, ctx.cycleTheme];
}

// ── Provider ──
const STORAGE_KEY = 'app-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved && THEME_ORDER.includes(saved)) return saved;
      // migrate from old vehicle-theme key
      const old = localStorage.getItem('vehicle-theme') as ThemeMode | null;
      if (old && THEME_ORDER.includes(old)) {
        localStorage.setItem(STORAGE_KEY, old);
        return old;
      }
    } catch {}
    return 'grey';
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode]);

  const cycleTheme = useCallback(() => {
    setMode(prev => {
      const idx = THEME_ORDER.indexOf(prev);
      return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    });
  }, []);

  const value: ThemeContextValue = {
    theme: THEMES[mode],
    themeMode: mode,
    cycleTheme,
  };

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

// ── Reusable toggle button ──
export function ThemeToggleButton({ className }: { className?: string }) {
  const [mode, cycle] = useThemeMode();
  const t = useTheme();
  return (
    <button
      onClick={cycle}
      className={className}
      style={{
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily: 'inherit',
        border: `1px solid ${t.inputBorder}`,
        background: t.inputBg,
        color: t.textMuted,
        padding: '2px 8px',
        cursor: 'pointer',
      }}
      title={`Theme: ${mode} — click to cycle`}
    >
      {THEME_ICONS[mode]} {mode.toUpperCase()}
    </button>
  );
}
