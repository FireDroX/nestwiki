#!/bin/sh
set -e
pnpm run migration:run
pnpm run seed:content || echo "seed:content failed (no user in DB yet on a fresh deploy?) — skipping, will retry on next deploy"
node --import ./scripts/register-stream-json-case-loader.mjs dist/main.js
