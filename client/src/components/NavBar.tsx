import { Link, useLocation } from "wouter";
import { useTheme, useThemeMode, THEME_ICONS } from "@/lib/theme";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  accentColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "GAUGES", icon: "⚡" },
  { href: "/ecu", label: "ECU", icon: "🔧" },
  { href: "/vehicle", label: "VEHICLE", icon: "🚗" },
  { href: "/friends", label: "FRIENDS", icon: "👥" },
  { href: "/export", label: "EXPORT", icon: "📦" },
  { href: "/admin", label: "ADMIN", icon: "⚙", accentColor: "#eab308" },
];

export function NavBar() {
  const [location] = useLocation();
  const t = useTheme();
  const [themeMode, cycleTheme] = useThemeMode();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 8px",
        background: t.navBg,
        borderBottom: `1px solid ${t.borderFaint}`,
        minHeight: 36,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/"
          ? location === "/"
          : location.startsWith(item.href);
        const activeColor = item.accentColor || t.activeText;
        const activeBorderColor = item.accentColor || t.accent;

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 10px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "inherit",
              textDecoration: "none",
              whiteSpace: "nowrap",
              color: isActive ? activeColor : t.textDim,
              borderBottom: isActive
                ? `2px solid ${activeBorderColor}`
                : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            <span style={{ marginRight: 4 }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      {/* Theme toggle */}
      <div style={{ marginLeft: "auto", flexShrink: 0, paddingRight: 4 }}>
        <button
          onClick={cycleTheme}
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            border: `1px solid ${t.inputBorder}`,
            background: t.inputBg,
            color: t.textMuted,
            padding: "3px 8px",
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
