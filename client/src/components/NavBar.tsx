import { Link, useLocation } from "wouter";
import { useTheme, useThemeMode, THEME_ICONS } from "@/lib/theme";

interface NavItem {
  href: string;
  label: string;
  aliases?: string[];         // old routes that also highlight this tab
  accentColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",        label: "RUN" },
  { href: "/setup",   label: "SETUP",   aliases: ["/ecu", "/vehicle"] },
  { href: "/analyze", label: "ANALYZE" },
  { href: "/dyno",    label: "DYNO" },
  { href: "/social",  label: "SOCIAL",  aliases: ["/friends"] },
  { href: "/export",  label: "EXPORT" },
  { href: "/admin",   label: "ADMIN",   accentColor: "#eab308" },
];

export function NavBar() {
  const [location] = useLocation();
  const t = useTheme();
  const [themeMode, cycleTheme] = useThemeMode();

  const isItemActive = (item: NavItem) => {
    if (item.href === "/") return location === "/";
    if (location.startsWith(item.href)) return true;
    return item.aliases?.some(a => location.startsWith(a)) ?? false;
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 12px",
        background: t.navBg,
        borderBottom: `1px solid ${t.borderFaint}`,
        minHeight: 40,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: "0.12em",
          color: t.accent,
          textDecoration: "none",
          marginRight: 16,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        MONO5
      </Link>

      {NAV_ITEMS.map((item) => {
        const active = isItemActive(item);
        const activeColor = item.accentColor || t.activeText;

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "10px 12px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
              textDecoration: "none",
              whiteSpace: "nowrap",
              color: active ? activeColor : t.textDim,
              borderBottom: active
                ? `2px solid ${item.accentColor || t.accent}`
                : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {item.label}
          </Link>
        );
      })}

      {/* Theme toggle */}
      <div style={{ marginLeft: "auto", flexShrink: 0, paddingRight: 4 }}>
        <button
          onClick={cycleTheme}
          style={{
            fontSize: 11,
            fontFamily: "'Inter', system-ui, sans-serif",
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 4,
            background: t.inputBg,
            color: t.textMuted,
            padding: "4px 10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          title={`Theme: ${themeMode}`}
        >
          {THEME_ICONS[themeMode]}
        </button>
      </div>
    </nav>
  );
}
