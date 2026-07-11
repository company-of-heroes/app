/// <reference path="../pb_data/types.d.ts" />

// Smurf watch backfill runs incrementally from pb_hooks/smurf-watch.pb.js:
// - onBootstrap: first batch after server start
// - cron every 5 minutes until all lobbies are processed
// - POST /api/smurf-watch/backfill/run?reset=true (service token or superuser)
migrate(() => {}, () => {});
