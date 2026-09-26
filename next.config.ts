import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",
  // Keep puppeteer out of the bundle — it must load its own binary/launcher at
  // runtime from node_modules rather than being traced/rewritten by the bundler.
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
