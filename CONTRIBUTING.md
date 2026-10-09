# Contributing to NestWiki

Thanks for your interest in NestWiki! Bug reports, ideas, documentation fixes and pull requests are all welcome. By taking part you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

Security problems are handled privately: see [SECURITY.md](SECURITY.md) instead of opening an issue.

## Before you start

- **Bugs** — search the existing issues first, then open one with the version, the steps to reproduce, what you expected and what happened.
- **Features** — open an issue to discuss the idea before writing code, so we can agree on the approach. Small fixes can go straight to a pull request.

## Setting up

Follow the [Development](README.md#development) section of the README: Node.js 22+, pnpm (the version pinned in `package.json`) and Docker for MySQL and the object storage. Copy the three `.env.example` files and generate real secrets with `openssl rand -hex 32`: the API refuses to start with default values, unless `DEV=true` is set in `backend/.env` (local development only).

Use `pnpm`, not `npm` or `yarn`. Prefer dependencies without native build scripts (for example `bcryptjs` rather than `bcrypt`).

## Project layout

- `backend/` — NestJS + TypeORM API. One folder per domain (`pages`, `users`, `permissions`…), each split the same way: `*.controller.ts` (HTTP only), `services/` (business logic and validation, throwing domain exceptions from `common/exceptions`), `dto/in` and `dto/out`, `entities/`, `persistence/` (repository interface + TypeORM adapter) and `mapper/`. Follow an existing module rather than inventing a new layout.
- `backend/src/database/migrations/` — every schema change is a hand-reviewed migration written in raw SQL. `synchronize` is never enabled.
- `frontend/` — React + TypeScript + Vite, Tailwind and shadcn/ui. API calls live in `src/api/`, one component per route in `src/pages/`, page-specific components in `src/components/<Page>/`. Do not edit the generated `src/components/ui/` files by hand.
- `docs/technical-spec.md` — data model and the full list of endpoints.

## Conventions

- **No code comments**: prefer clear names and small functions.
- **Tests**: add or update tests with every change, using Vitest. Backend unit tests mock repositories and services (see `backend/src/pages/services/pages.service.spec.ts`); end-to-end tests live in `backend/test/`.
- **Error messages** returned by the API are in English; user-facing text goes through the `fr` and `en` translation files.
- **Pages are addressed by their full path** (`/pages/a/b/c`), never by a bare slug.
- Run before pushing:

  ```bash
  pnpm --filter backend run lint
  pnpm --filter backend run test
  pnpm --filter frontend run test
  pnpm --filter frontend run build
  ```

## Versioning and changelog

Every pull request that changes behavior:

1. bumps the version in the three `package.json` files (root, `backend`, `frontend`), kept identical — patch number for fixes and features within the current minor version;
2. adds a section at the top of [CHANGELOG.md](CHANGELOG.md):

   ```md
   ## 1.0.5 — 2026-10-12

   - What changed, from the user's point of view.
   ```

   This file feeds the in-app release notes page and the GitHub release of that version, so describe the change for people running NestWiki, and flag anything they must do when upgrading with ⚠️.

## Pull requests

- Branch from `main`, keep each pull request focused on one change.
- Describe what changed, why, and how you tested it; link the related issue.
- The CI must pass (lint and tests for both packages).
- By submitting a contribution you agree to license it under the [AGPL-3.0](LICENSE), the license of the project.
