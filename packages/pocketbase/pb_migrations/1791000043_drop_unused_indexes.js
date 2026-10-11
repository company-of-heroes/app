/// <reference path="../pb_data/types.d.ts" />

// Every write to lobbies and replays maintains these indexes, and the `players` ones
// hold the whole players JSON (~20KB per row). `EXPLAIN QUERY PLAN` on the history,
// feed, replay and lookup queries shows none of them is needed:
// - lobbies.idx_lobbies_players_agg, lobbies.idx_lobbies_user_players_agg: only
//   `players = ?` equality could use them, which nothing queries. The planner picks
//   user_players_agg for `user = ?`, but (user, createdAt) covers that prefix.
// - replays.idx_replays_players_agg: the replay `players ~ ?` filter is a LIKE '%x%',
//   which no btree index serves.
// - replays.idx_replays_createdBy_players_agg: partial (`createdBy != ''`), so it is
//   never used for `createdBy = ?`; it fed the removed replay_aggregation view.
// - lobbies.idx_lobbies_map_agg: a prefix of idx_lobbies_map_finished (map, needsResult, title).
// - lobbies.idx_lobbies_{like,download,comment}_count: only an unfiltered counter sort
//   uses them. Every list adds the needsResult/isHidden/isCommunity scope, which the
//   idx_lobbies_feed_* indexes serve.
// idx_8b5JbSpePY (title, map) stays: lobbies.ts looks up lobbies by title.
const LOBBY_INDEXES = {
	idx_lobbies_players_agg: 'CREATE INDEX `idx_lobbies_players_agg` ON `lobbies` (`players`)',
	idx_lobbies_user_players_agg:
		'CREATE INDEX `idx_lobbies_user_players_agg` ON `lobbies` (\n  `user`,\n  `players`\n)',
	idx_lobbies_map_agg: 'CREATE INDEX `idx_lobbies_map_agg` ON `lobbies` (`map`)',
	idx_lobbies_like_count: 'CREATE INDEX `idx_lobbies_like_count` ON `lobbies` (`likeCount`)',
	idx_lobbies_download_count:
		'CREATE INDEX `idx_lobbies_download_count` ON `lobbies` (`downloadCount`)',
	idx_lobbies_comment_count: 'CREATE INDEX `idx_lobbies_comment_count` ON `lobbies` (`commentCount`)'
};

const REPLAY_INDEXES = {
	idx_replays_players_agg: 'CREATE INDEX `idx_replays_players_agg` ON `replays` (`players`)',
	idx_replays_createdBy_players_agg:
		"CREATE INDEX `idx_replays_createdBy_players_agg` ON `replays` (\n  `createdBy`,\n  `players`\n) WHERE `createdBy` != ''"
};

function drop(app, collectionName, indexes) {
	const collection = app.findCollectionByNameOrId(collectionName);
	collection.indexes = collection.indexes.filter(
		(index) => !Object.keys(indexes).some((name) => index.includes(`\`${name}\``))
	);
	app.save(collection);
}

function restore(app, collectionName, indexes) {
	const collection = app.findCollectionByNameOrId(collectionName);
	for (const [name, sql] of Object.entries(indexes)) {
		if (!collection.indexes.some((index) => index.includes(`\`${name}\``))) {
			collection.indexes.push(sql);
		}
	}

	app.save(collection);
}

migrate(
	(app) => {
		drop(app, 'lobbies', LOBBY_INDEXES);
		drop(app, 'replays', REPLAY_INDEXES);
	},
	(app) => {
		restore(app, 'lobbies', LOBBY_INDEXES);
		restore(app, 'replays', REPLAY_INDEXES);
	}
);
