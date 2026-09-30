/// <reference path="../pb_data/types.d.ts" />

// Stored filter columns on lobbies, so match history can be queried with plain
// PocketBase filters instead of raw SQL over the `result` JSON:
//   matchtypeId, playerCount  - from result.matchtype_id / result.players
//   isPro                     - ranked + average ELO threshold per match type
//   isCommunity               - finished, not Skirmish, has a replay, not a member replay
//   isHidden                  - hidden by staff (session id or title keyword)
// Kept current by pb_hooks/lib/lobby-columns.js until the website owns lobby writes.
// The SQL below is a frozen copy of that file's statement.

const TITLE_SEPARATORS = '-_/.():,;!?#@+=\'"[]{}|\\~*&%<>`^'.split('');

function normalizedTitleSql(expr) {
	let sql = `COALESCE(${expr}, '')`;
	for (const sep of TITLE_SEPARATORS) {
		sql = `REPLACE(${sql}, '${sep.replace(/'/g, "''")}', ' ')`;
	}
	return `LOWER(' ' || ${sql} || ' ')`;
}

function refreshSql(where) {
	const result = "(CASE WHEN json_valid(result) THEN result ELSE '{}' END)";
	const matchtype = `CAST(json_extract(${result}, '$.matchtype_id') AS INTEGER)`;
	const players = `json_array_length(json_extract(${result}, '$.players'))`;
	const title = normalizedTitleSql(`json_extract(${result}, '$.description')`);
	const word = `REPLACE(REPLACE(REPLACE(${normalizedTitleSql('k.word')}, '\\', '\\\\'), '%', '\\%'), '_', '\\_')`;
	return `UPDATE lobbies SET
		matchtypeId = COALESCE(${matchtype}, 0),
		playerCount = COALESCE(${players}, 0),
		isPro = (isRanked = 1 AND avgElo IS NOT NULL AND CASE
			WHEN ${matchtype} = 1 THEN avgElo >= 1800
			WHEN ${matchtype} IN (2, 3, 4, 5, 6, 7) THEN avgElo >= 1850
			WHEN ${players} = 2 THEN avgElo >= 1800
			WHEN ${players} IN (4, 6, 8) THEN avgElo >= 1850
			ELSE 0 END),
		isCommunity = (needsResult = 0 AND title != 'Skirmish' AND hasReplay = 1 AND COALESCE(memberReplay, '') = ''),
		isHidden = (
			EXISTS (SELECT 1 FROM hidden_matches h WHERE h.sessionId = lobbies.sessionId)
			OR EXISTS (SELECT 1 FROM hidden_match_keywords k WHERE TRIM(k.word) != '' AND ${title} LIKE '%' || ${word} || '%' ESCAPE '\\')
		)
	WHERE ${where}`;
}

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.fields.add(new NumberField({ name: 'matchtypeId', onlyInt: true }));
		lobbies.fields.add(new NumberField({ name: 'playerCount', onlyInt: true }));
		lobbies.fields.add(new BoolField({ name: 'isPro' }));
		lobbies.fields.add(new BoolField({ name: 'isCommunity' }));
		lobbies.fields.add(new BoolField({ name: 'isHidden' }));

		// The community index was created by a cron with raw DDL; recreate it as a managed index.
		app.db().newQuery('DROP INDEX IF EXISTS `idx_lobbies_community_replays`').execute();
		lobbies.indexes.push(
			'CREATE INDEX `idx_lobbies_community_feed` ON `lobbies` (`isCommunity`, `isHidden`, `createdAt`)',
			'CREATE INDEX `idx_lobbies_community_replays` ON `lobbies` (`createdAt`, `title`, `sessionId`) WHERE `hasReplay` = 1 AND `needsResult` = 0'
		);
		app.save(lobbies);

		app.db().newQuery(refreshSql('1 = 1')).execute();

		// Duplicate sessions used to be merged by the lobbies_dedupe cron. A unique index
		// replaces it, but only when the data is already clean; otherwise keep going and
		// let a later migration add it after the duplicates are resolved.
		const duplicates = new DynamicModel({ total: 0 });
		app
			.db()
			.newQuery(
				'SELECT COUNT(*) AS total FROM (SELECT sessionId FROM lobbies WHERE sessionId > 0 GROUP BY sessionId HAVING COUNT(*) > 1)'
			)
			.one(duplicates);
		if (duplicates.total > 0) {
			console.warn(
				`[migration] ${duplicates.total} duplicate lobby sessions; unique index not created`
			);
			return;
		}

		const withUnique = app.findCollectionByNameOrId('lobbies');
		withUnique.indexes.push(
			'CREATE UNIQUE INDEX `idx_lobbies_session_unique` ON `lobbies` (`sessionId`) WHERE `sessionId` > 0'
		);
		app.save(withUnique);
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		for (const name of ['matchtypeId', 'playerCount', 'isPro', 'isCommunity', 'isHidden']) {
			lobbies.fields.removeByName(name);
		}
		lobbies.indexes = lobbies.indexes.filter(
			(index) =>
				!index.includes('`idx_lobbies_community_feed`') &&
				!index.includes('`idx_lobbies_session_unique`') &&
				!index.includes('`idx_lobbies_community_replays`')
		);
		app.save(lobbies);
	}
);
