import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    // only this app's tests — `deprecated/` keeps its own (uninstalled) test suites
    include: ["test/**/*.test.ts"],
    exclude: ["deprecated/**", "node_modules/**", ".next/**"],
  },
});
