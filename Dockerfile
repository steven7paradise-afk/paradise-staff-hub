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
# Keep enough memory available for Docker/BuildKit on the deployment host.
# Next is already configured to compile with one worker in next.config.ts.
ENV NODE_OPTIONS="--max-old-space-size=768"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM deps AS production-deps

RUN npm prune --omit=dev --no-audit --no-fund

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

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=6 \
  CMD curl --fail --silent --show-error "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1

CMD ["npm", "run", "start"]
