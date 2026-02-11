import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { initializeCapacitor, initializePushNotifications } from "./lib/capacitor";
import { logError } from "./lib/error-logger";

// Global error handlers — catch unhandled errors and log to Supabase
window.onerror = (message, source, lineno, colno, error) => {
  logError({
    message: typeof message === 'string' ? message : 'Unknown error',
    stack: error?.stack,
    source: 'window.onerror',
    severity: 'error',
    metadata: { fileSource: source, lineno, colno },
  });
};

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const error = event.reason;
  logError({
    message: error?.message ?? String(error),
    stack: error?.stack,
    source: 'unhandledrejection',
    severity: 'error',
    metadata: { reason: String(error) },
  });
};

// Register service worker for PWA (PROD only).
// In DEV/preview, a Service Worker can cache Vite pre-bundled deps and cause
// a React instance mismatch (e.g. "Cannot read properties of null (reading 'useEffect')").
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: 'none' })
        .then((registration) => {
          console.log("SW registered:", registration.scope);
          // Check for updates immediately and then periodically
          registration.update();
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    });
  } else {
    // DEV: ensure any previously installed SW is removed and its caches are cleared.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      });
    }
  }
}

// Initialize Capacitor for native functionality
initializeCapacitor().then(() => {
  // Push notifications require google-services.json / Firebase to be configured.
  // Calling register() without Firebase causes a native FATAL EXCEPTION.
  // Uncomment when Firebase is set up:
  // initializePushNotifications();
});

createRoot(document.getElementById("root")!).render(<App />);
