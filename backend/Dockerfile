# Built from the repo root (pnpm workspace): docker build -f backend/Dockerfile .

# Every ticket bumps "version" in the three package.json files. Copied
# as-is, that bump would invalidate every dependency layer below on each
# release, so a deploy would re-download the whole node_modules layer
# even with an unchanged lockfile. Stripping it here keeps those layers
# byte-identical (and served from the build cache) until the lockfile or
# the dependency lists actually change.
FROM node:22-alpine AS manifests
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN node -e "for (const file of ['package.json', 'backend/package.json', 'frontend/package.json']) { const fs = require('fs'); const manifest = JSON.parse(fs.readFileSync(file, 'utf8')); delete manifest.version; fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n'); }"

FROM node:22-alpine AS base
WORKDIR /app
COPY --from=manifests /app/package.json ./
RUN corepack enable && pnpm --version

FROM base AS deps
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --filter backend...

FROM deps AS build
COPY backend backend
RUN pnpm --filter backend run build

# Separate from `deps`: --prod (no devDependencies, tsx included) and
# --filter (no frontend workspace) so pnpm's own store/cache never ends
# up in the runtime image's layers — only what `COPY --from=` below
# pulls out of it does.
FROM base AS prod-deps
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --prod --filter backend...

# Plain node, no pnpm: entrypoint.sh runs the compiled migrations and
# seeds from dist/ with `node` directly, so neither pnpm, tsx nor the
# TypeScript sources are needed at runtime.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/backend/node_modules ./backend/node_modules
COPY backend/scripts ./backend/scripts
COPY --chmod=755 backend/entrypoint.sh ./backend/entrypoint.sh
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json
COPY CHANGELOG.md ./CHANGELOG.md

WORKDIR /app/backend
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
