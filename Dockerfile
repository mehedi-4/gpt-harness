# syntax=docker/dockerfile:1

# --- deps: install dependencies ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Skip Puppeteer's bundled Chromium download — the runner uses the distro's
# chromium package instead (smaller, patched by the OS).
ENV PUPPETEER_SKIP_DOWNLOAD=1
# `npm install` (not `npm ci`): the lockfile carries platform-specific optional
# native deps (sharp/oxide/unrs-resolver wasm variants) that resolve differently
# in this Linux image, which trips `npm ci`'s strict in-sync check.
RUN npm install --no-audit --no-fund

# --- builder: compile the Next.js standalone output ---
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm run build

# --- runner: image serving the standalone server, with headless Chromium ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Chromium + the fonts headless Chrome needs to render text/math for PDFs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     chromium fonts-liberation fonts-noto-core fonts-noto-cjk ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Point Puppeteer at the distro Chromium instead of a bundled download.
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# The standalone build bundles a minimal node_modules + server.js. Static
# assets and the public dir are copied alongside it as Next expects.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Puppeteer is a serverExternalPackage (not bundled), so ship its runtime from
# the full install to guarantee the launcher is present in the standalone image.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/puppeteer ./node_modules/puppeteer
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/puppeteer-core ./node_modules/puppeteer-core

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
