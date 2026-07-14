# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile

# ---------- build ----------
FROM oven/bun:1.1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build as a Node server (Nitro preset) instead of Cloudflare Workers,
# so the output can run directly on TrueNAS / any Docker host.
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production
RUN bun run build

# ---------- runtime ----------
# Debian (not Alpine) because its ffmpeg package is built with h264_nvenc /
# h264_qsv / h264_vaapi — we need those for GPU-accelerated transcoding.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# ffmpeg + ffprobe power the auto-encoder worker (src/lib/encoder.server.ts).
# Also install wget for the HEALTHCHECK. `--no-install-recommends` keeps the
# image lean; ffmpeg on bookworm includes CPU (libx264), NVIDIA (h264_nvenc),
# Intel (h264_qsv), and AMD/Intel VA-API (h264_vaapi) encoders.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy the Nitro node-server output. Everything the server needs is bundled
# inside .output; we don't ship node_modules or source.
COPY --from=build /app/.output ./.output

EXPOSE 3000

# Watchtower / TrueNAS health checks hit the root route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", ".output/server/index.mjs"]

