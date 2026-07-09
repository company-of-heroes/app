/// <reference path="../pb_data/types.d.ts" />

// Backfill is intentionally NOT run during startup — it can block large databases for minutes.
// Run manually after deploy: node scripts/backfill-lobby-players.mjs
migrate(() => {}, () => {});
