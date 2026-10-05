# Built from the repo root (pnpm workspace): docker build -f backend/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /app
# Pre-fetch the pinned pnpm version here (not just `corepack enable`) so
# it's baked into every stage below via layer inheritance, `runtime`
# included — otherwise corepack downloads it lazily on first `pnpm`
# invocation, which for `runtime` means at container startup (entrypoint.sh
# calls `pnpm run migration:run`), adding a network dependency and latency
# to every cold start.
COPY package.json ./
RUN corepack enable && pnpm --version

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter backend...

FROM deps AS build
COPY backend backend
RUN pnpm --filter backend run build

# Separate from `deps`: --prod (no devDependencies) and --filter (no
# frontend workspace) so the actual pnpm store/cache this creates never
# ends up in the runtime image's layers — only what `COPY --from=` below
# pulls out of it does. This is what previously made the backend image
# ~1.2GB: a full, unfiltered `pnpm install` run directly in the runtime
# stage baked in every backend+frontend devDependency (React, Vite,
# Tailwind, shiki, ...) plus pnpm's own content-addressable store.
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --prod --filter backend...

FROM base AS runtime
ENV NODE_ENV=production
# pnpm-workspace.yaml + pnpm-lock.yaml must be present, not just the
# package.jsons: without them pnpm doesn't recognize /app/backend as a
# member of an already-fully-installed workspace and re-resolves (and
# re-downloads over the network) entrypoint.sh's `pnpm run migration:run`
# at container startup instead of just running the script.
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/entrypoint.sh ./backend/entrypoint.sh
COPY CHANGELOG.md ./CHANGELOG.md
RUN chmod +x ./backend/entrypoint.sh

WORKDIR /app/backend
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
