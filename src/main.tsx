import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { initializeCapacitor, initializePushNotifications } from "./lib/capacitor";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

// Initialize Capacitor for native functionality
initializeCapacitor().then(() => {
  // Push notifications require google-services.json / Firebase to be configured.
  // Calling register() without Firebase causes a native FATAL EXCEPTION.
  // Uncomment when Firebase is set up:
  // initializePushNotifications();
});

createRoot(document.getElementById("root")!).render(<App />);
