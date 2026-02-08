import { useState, useEffect } from "react";

export default function ExportPage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/export")
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "2px" }}>
            PROJECT EXPORT
          </div>
          <div style={{ fontSize: "10px", opacity: 0.4, marginTop: "2px" }}>
            ENGINE MONITOR DASHBOARD - ALL SOURCE FILES
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <a
            href="/api/export/download"
            download="FULL_PROJECT_EXPORT.txt"
            style={{
              fontSize: "11px",
              letterSpacing: "1px",
              border: "1px solid rgba(255,255,255,0.3)",
              padding: "6px 16px",
              color: "#fff",
              textDecoration: "none",
              cursor: "pointer",
            }}
            data-testid="link-download"
          >
            DOWNLOAD .TXT FILE
          </a>
          <button
            onClick={handleCopy}
            style={{
              fontSize: "11px",
              letterSpacing: "1px",
              border: "1px solid rgba(255,255,255,0.3)",
              padding: "6px 16px",
              background: copied ? "rgba(0,255,0,0.15)" : "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
            data-testid="button-copy-all"
          >
            {copied ? "COPIED!" : "COPY ALL TO CLIPBOARD"}
          </button>
          <a
            href="/"
            style={{
              fontSize: "11px",
              letterSpacing: "1px",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "6px 16px",
              color: "#fff",
              textDecoration: "none",
              opacity: 0.5,
            }}
            data-testid="link-back-dashboard"
          >
            BACK TO DASHBOARD
          </a>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {loading ? (
          <div style={{ opacity: 0.5, fontSize: "12px" }}>Loading export...</div>
        ) : (
          <pre
            style={{
              fontSize: "11px",
              lineHeight: "1.5",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              opacity: 0.85,
            }}
            data-testid="text-export-content"
          >
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
