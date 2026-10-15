import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => ({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./worker/wrangler.jsonc" },
    miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations("./worker/migrations") } },
  })],
  test: { include: ["tests/worker.test.ts"], testTimeout: 15_000 },
}));
