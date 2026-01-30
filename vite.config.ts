import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Tauri packages that need special handling
const tauriPackages = [
  "@tauri-apps/api",
  "@tauri-apps/plugin-updater",
  "@tauri-apps/plugin-process",
  "@tauri-apps/plugin-shell",
];

// Check if we're building for Tauri (set by tauri build command)
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig(({ mode }) => ({
  // Lovable Cloud injects VITE_SUPABASE_* env vars automatically.
  // In rare cases (cache/build issues), they can be missing at runtime which
  // causes `@supabase/supabase-js` to throw: "supabaseUrl is required".
  //
  // These defines provide a safe fallback so the app doesn't blank-screen.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? "https://phbehenczyryrlxmgjju.supabase.co"
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYmVoZW5jenlyeXJseG1namp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzUyMDcsImV4cCI6MjA4MjkxMTIwN30.CAeAOxHeM5-Lij0rnI1FmicMf8TW0Qzy5s-jxRn0uBk"
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // Only exclude Tauri plugins from pre-bundling in web mode
    exclude: isTauriBuild ? [] : tauriPackages,
    // Force include React packages to ensure single instance
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "next-themes",
    ],
    // Force re-bundling when deps change
    force: true,
    esbuildOptions: {
      // Ensure React is resolved to a single instance
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    rollupOptions: {
      // Only mark Tauri plugins as external for web builds, NOT for Tauri builds
      external: isTauriBuild
        ? []
        : (id) => tauriPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
    },
  },
}));
