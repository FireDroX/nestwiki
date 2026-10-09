# check=skip=SecretsUsedInArgOrEnv
# Built from the repo root (pnpm workspace): docker build -f frontend/Dockerfile .

# Same as backend/Dockerfile: strip the per-ticket "version" bump so the
# dependency install layer stays cached until the lockfile changes.
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
RUN pnpm install --frozen-lockfile --filter frontend...

FROM deps AS build
COPY frontend frontend
# Vite bakes these into the bundle at build time — override with
# --build-arg for a real deployment, empty defaults just let the image
# build. Build args are already environment variables for the RUN below,
# no ENV needed. VITE_TURNSTILE_SITE_KEY is Turnstile's *public* site
# key, shipped to every browser in the bundle anyway (the secret key
# lives only in backend/.env), hence the SecretsUsedInArgOrEnv skip at
# the top of this file.
ARG VITE_API_URL=
ARG VITE_TURNSTILE_SITE_KEY=
RUN pnpm --filter frontend run build

FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
