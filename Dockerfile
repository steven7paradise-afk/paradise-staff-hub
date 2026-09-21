# syntax=docker/dockerfile:1.7

FROM node:22.13.1-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package*.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
  npm ci --no-audit --no-fund

FROM base AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The deployment host has 8 GB RAM. Keep the build heap bounded while allowing
# the full application (including monitoring) to compile without V8 heap OOM.
# This limit applies only to the builder, not the production runtime.
ENV NODE_OPTIONS="--max-old-space-size=2048"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Builds run on the same Coolify host as production. Keep compilation at a
# lower CPU priority so a deploy cannot make the live staff app sluggish.
RUN nice -n 10 npm run build

FROM deps AS production-deps

RUN nice -n 10 npm prune --omit=dev --no-audit --no-fund

FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package*.json ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/start-production.sh ./scripts/start-production.sh
COPY --from=builder /app/scripts/backfill-pin-prefix-lookups.mjs ./scripts/backfill-pin-prefix-lookups.mjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=6 \
  CMD curl --fail --silent --show-error "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1

CMD ["npm", "run", "start"]
