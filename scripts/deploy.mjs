import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const config = JSON.parse(readFileSync(new URL("../worker/wrangler.jsonc", import.meta.url), "utf8"));
if (config.d1_databases[0].database_id === "00000000-0000-0000-0000-000000000000") {
  console.error("Create the Cloudflare D1 database and set database_id in worker/wrangler.jsonc. See README.md.");
  process.exit(1);
}
for (const script of ["lint", "check:types", "test", "build", "db:migrate:remote", "deploy:worker", "deploy:pages"]) {
  const result = spawnSync("npm", ["run", script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
