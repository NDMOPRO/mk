import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  define: {
    '__APP_BUILD_VERSION__': JSON.stringify(new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)),
    '__APP_BUILD_DATE__': JSON.stringify(new Date().toISOString()),
    '__APP_GIT_SHA__': JSON.stringify(
      process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7)
      || (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; } })()
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor: React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Vendor: Radix UI (shadcn primitives)
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // Vendor: tRPC + React Query
          if (id.includes('node_modules/@trpc/') || id.includes('node_modules/@tanstack/')) {
            return 'vendor-data';
          }
          // Vendor: Lucide icons
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          // Admin and dashboard pages are NOT grouped here — they rely on
          // React.lazy() dynamic imports in App.tsx so Vite produces separate
          // async chunks that are only fetched when the user navigates to them.
          // Grouping them into manualChunks caused Vite to add modulepreload
          // hints in the HTML, forcing every visitor (including mobile homepage
          // users) to download ~2MB of admin/dashboard JS upfront.
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".up.railway.app",
      ".monthlykey.com",
      "tg.monthlykey.com",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
