/// <reference path="../pb_data/types.d.ts" />

// Player ratings backfill runs incrementally from pb_hooks/player-ratings.pb.js:
// - cron every 5 minutes until all lobbies with a result are processed
// - POST /api/player-ratings/backfill/run?reset=true (service token or superuser)
migrate(
	() => {},
	() => {}
);
