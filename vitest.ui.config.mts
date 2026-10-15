import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/ui/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/ui/setup.ts"],
    restoreMocks: true,
  },
});
