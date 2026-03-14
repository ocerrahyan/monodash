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
    bg: '#000000',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.8)',
    textDim: 'rgba(255,255,255,0.5)',
    border: 'rgba(255,255,255,0.2)',
    borderFaint: 'rgba(255,255,255,0.05)',
    inputBg: 'transparent',
    inputBorder: 'rgba(255,255,255,0.25)',
    inputText: '#ffffff',
    selectBg: '#000000',
    activeBorder: 'rgba(255,255,255,0.7)',
    activeText: '#ffffff',
    inactiveText: 'rgba(255,255,255,0.5)',
    inactiveBorder: 'rgba(255,255,255,0.25)',
    accent: '#fb923c',
    navBg: '#000000',
    bottomBg: '#000000',
    btnHover: 'rgba(255,255,255,0.1)',
    cardBg: 'rgba(255,255,255,0.03)',
    cardBorder: 'rgba(255,255,255,0.08)',
  },
  grey: {
    bg: '#2d2d35',
    text: '#d4d4dc',
    textMuted: 'rgba(212,212,220,0.8)',
    textDim: 'rgba(212,212,220,0.45)',
    border: 'rgba(255,255,255,0.18)',
    borderFaint: 'rgba(255,255,255,0.07)',
    inputBg: '#3a3a44',
    inputBorder: 'rgba(255,255,255,0.22)',
    inputText: '#d4d4dc',
    selectBg: '#3a3a44',
    activeBorder: 'rgba(255,255,255,0.6)',
    activeText: '#d4d4dc',
    inactiveText: 'rgba(212,212,220,0.45)',
    inactiveBorder: 'rgba(255,255,255,0.18)',
    accent: '#fb923c',
    navBg: '#232329',
    bottomBg: '#232329',
    btnHover: 'rgba(255,255,255,0.1)',
    cardBg: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.1)',
  },
  light: {
    bg: '#ffffff',
    text: '#111111',
    textMuted: 'rgba(17,17,17,0.7)',
    textDim: 'rgba(17,17,17,0.4)',
    border: 'rgba(0,0,0,0.18)',
    borderFaint: 'rgba(0,0,0,0.08)',
    inputBg: '#f0f0f0',
    inputBorder: 'rgba(0,0,0,0.25)',
    inputText: '#111111',
    selectBg: '#f0f0f0',
    activeBorder: 'rgba(0,0,0,0.6)',
    activeText: '#111111',
    inactiveText: 'rgba(17,17,17,0.4)',
    inactiveBorder: 'rgba(0,0,0,0.18)',
    accent: '#c2410c',
    navBg: '#e0e0e0',
    bottomBg: '#e0e0e0',
    btnHover: 'rgba(0,0,0,0.08)',
    cardBg: 'rgba(0,0,0,0.03)',
    cardBorder: 'rgba(0,0,0,0.1)',
  },
};

export const THEME_ORDER: ThemeMode[] = ['dark', 'grey', 'light'];
export const THEME_ICONS: Record<ThemeMode, string> = { dark: '🌙', grey: '🌫', light: '☀' };

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
