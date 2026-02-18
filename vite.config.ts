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
    // force: true — removed to avoid unnecessary re-bundling on every dev start
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
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom", "react/jsx-runtime"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": [
            "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover", "@radix-ui/react-select",
            "@radix-ui/react-tabs", "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion", "@radix-ui/react-alert-dialog",
            "@radix-ui/react-checkbox", "@radix-ui/react-label",
            "@radix-ui/react-scroll-area", "@radix-ui/react-separator",
            "@radix-ui/react-slot", "@radix-ui/react-switch",
            "@radix-ui/react-toast", "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
          ],
          "vendor-charts": ["recharts"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-dates": ["date-fns"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "vendor-i18n": ["i18next", "react-i18next"],
        },
      },
    },
  },
}));
