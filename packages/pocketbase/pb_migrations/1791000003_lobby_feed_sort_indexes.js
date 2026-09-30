/// <reference path="../pb_data/types.d.ts" />

// Match history sorts the community feed by these counters, newest first on ties.
// Without an index covering filter + sort, SQLite sorts full rows (players JSON is
// ~20KB per lobby): 1-2s per page instead of ~20ms. One index per direction, since
// `count ASC, createdAt DESC` cannot use `count, createdAt` backwards.
const SORT_COLUMNS = ['likeCount', 'downloadCount', 'commentCount'];

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		for (const column of SORT_COLUMNS) {
			lobbies.indexes.push(
				`CREATE INDEX \`idx_lobbies_feed_${column}\` ON \`lobbies\` (\`isCommunity\`, \`isHidden\`, \`${column}\`, \`createdAt\`)`,
				`CREATE INDEX \`idx_lobbies_feed_${column}_asc\` ON \`lobbies\` (\`isCommunity\`, \`isHidden\`, \`${column}\`, \`createdAt\` DESC)`
			);
		}
		app.save(lobbies);
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.indexes = lobbies.indexes.filter((index) => !index.includes('`idx_lobbies_feed_'));
		app.save(lobbies);
	}
);
