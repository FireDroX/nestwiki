#!/bin/sh
set -e
STREAM_JSON_LOADER=./scripts/register-stream-json-case-loader.mjs
node --import "$STREAM_JSON_LOADER" ./node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js
node dist/database/run-admin-seed.js
node dist/database/content-seed.js
exec node --import "$STREAM_JSON_LOADER" dist/main.js
