/// <reference path="../pb_data/types.d.ts" />

// Lobby players + lobby_player_index backfill runs incrementally from pb_hooks/lobby-players.pb.js:
// - onBootstrap: first batch after server start
// - cron every 5 minutes until all lobbies are processed
// - POST /api/lobby-players/backfill/run?reset=true (service token or superuser)
migrate(() => {}, () => {});
