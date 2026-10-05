#!/bin/sh
set -e
pnpm run migration:run
pnpm run seed:admin
pnpm run seed:content
node --import ./scripts/register-stream-json-case-loader.mjs dist/main.js
