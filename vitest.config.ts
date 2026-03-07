import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [react()],
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
      "@mk/shared": path.resolve(templateRoot, "packages", "shared", "src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
      "tests/**/*.test.tsx",
      "tests/**/*.spec.tsx",
    ],
    exclude: [
      "server/integration.test.ts",
      "server/__tests__/otp.test.ts",
      "server/booking-calculator.test.ts",
      "server/tests/finance-registry.test.ts",
      "server/tests/moyasar.test.ts",
      "server/tests/payment-badges.test.ts",
      "server/tests/payment-hardening.test.ts",
      "node_modules/**",
    ],
    environmentMatchGlobs: [
      ["tests/widget/**", "jsdom"],
    ],
    setupFiles: ["tests/setup/widget-setup.ts"],
  },
});
