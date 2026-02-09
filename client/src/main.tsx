import { createRoot } from "react-dom/client";
import { Component, ErrorInfo, ReactNode } from "react";
import App from "./App";
import "./index.css";
import { log, logError } from "@shared/logger";

log.info('app', 'Mono5 Engine Simulator starting...');
log.info('app', `Environment: ${import.meta.env.MODE}, URL: ${window.location.href}`);

// Global error handler for uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  logError('global', error || message, `Uncaught error at ${source}:${lineno}`);
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `
      <div style="background:#1a1a2e;color:#eee;padding:40px;font-family:monospace;min-height:100vh;">
        <h1 style="color:#ff6b6b;">⚠️ JavaScript Error</h1>
        <p>Check browser console (F12) for details.</p>
        <pre style="color:#ff6b6b;background:#0d0d1a;padding:20px;border-radius:8px;white-space:pre-wrap;">${message}\n\nSource: ${source}\nLine: ${lineno}</pre>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#4a4a6a;color:#fff;border:none;cursor:pointer;">Reload</button>
      </div>
    `;
  }
};

// Promise rejection handler
window.onunhandledrejection = (event) => {
  logError('global', event.reason, 'Unhandled promise rejection');
};

// Error boundary to prevent blank white screens
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          background: '#1a1a2e', 
          color: '#eee', 
          padding: 40, 
          fontFamily: 'JetBrains Mono, monospace',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: 20 }}>⚠️ Application Error</h1>
          <p style={{ marginBottom: 20 }}>Something went wrong. Check the console for details.</p>
          <details style={{ background: '#0d0d1a', padding: 20, borderRadius: 8 }}>
            <summary style={{ cursor: 'pointer', marginBottom: 10 }}>Error Details</summary>
            <pre style={{ 
              color: '#ff6b6b', 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontSize: 12
            }}>
              {this.state.error?.toString()}
              {'\n\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              background: '#4a4a6a',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
