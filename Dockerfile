FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS cpi-worker
COPY scripts ./scripts
ENV NODE_ENV=production TZ=America/Costa_Rica
USER node
CMD ["node", "scripts/self-host/run-cpi.mjs"]

FROM node:24-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=2048
# Keep the image buildable before TuStore's independent Supabase is provisioned.
# Coolify may pass unset build arguments as empty strings, which would otherwise
# override the safe client-side fallbacks in src/lib/supabase.ts.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-public-key
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_ORIGIN
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_HOSTS
ARG NEXT_PUBLIC_TUSTORE_PREVIOUS_STORAGE_ORIGINS
ARG NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_ORIGIN=https://mail.tustorecr.com
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_ORIGIN=$NEXT_PUBLIC_SITE_ORIGIN
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_HOSTS=$NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_HOSTS
ENV NEXT_PUBLIC_TUSTORE_PREVIOUS_STORAGE_ORIGINS=$NEXT_PUBLIC_TUSTORE_PREVIOUS_STORAGE_ORIGINS
ENV NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_ORIGIN=$NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Coolify's HTTP healthcheck probes the container with curl/wget.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs scripts/self-host/check-runtime.mjs scripts/self-host/run-reminder.mjs scripts/self-host/healthcheck.mjs ./scripts/self-host/

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD ["node", "scripts/self-host/healthcheck.mjs"]
CMD ["node", "server.js"]
