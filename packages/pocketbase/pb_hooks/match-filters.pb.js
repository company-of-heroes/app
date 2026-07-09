/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('GET', '/api/match-filters/{scope}', (e) => {
	const scope = e.request.pathValue('scope');
	const userId = e.request.url.query().get('userId');

	try {
		if (scope === 'community') {
			const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
			const mapsRaw = snapshot.get('maps');
			const playersRaw = snapshot.get('players');
			let maps = Array.isArray(mapsRaw) ? mapsRaw : [];
			let players = Array.isArray(playersRaw) ? playersRaw : [];

			if (typeof mapsRaw === 'string' && mapsRaw.length > 0) {
				maps = JSON.parse(mapsRaw);
			}

			if (typeof playersRaw === 'string' && playersRaw.length > 0) {
				players = JSON.parse(playersRaw);
			}

			return e.json(200, { maps, players });
		}

		if (scope === 'user') {
			if (!userId) {
				return e.json(400, { message: 'userId required for user scope' });
			}

			const snapshotId = `user:${userId}`;

			try {
				const snapshot = $app.findRecordById('match_filter_snapshots', snapshotId);
				const mapsRaw = snapshot.get('maps');
				const playersRaw = snapshot.get('players');
				let maps = Array.isArray(mapsRaw) ? mapsRaw : [];
				let players = Array.isArray(playersRaw) ? playersRaw : [];

				if (typeof mapsRaw === 'string' && mapsRaw.length > 0) {
					maps = JSON.parse(mapsRaw);
				}

				if (typeof playersRaw === 'string' && playersRaw.length > 0) {
					players = JSON.parse(playersRaw);
				}

				return e.json(200, { maps, players });
			} catch {
				// Build and cache the first user snapshot below.
			}

			const bindings = { userId };
			const where =
				"needsResult = 0 AND title != 'Skirmish' AND user = {:userId}";

			const mapRows = arrayOf(new DynamicModel({ value: '' }));
			$app
				.db()
				.newQuery(
					`SELECT DISTINCT map AS value
           FROM lobbies
           WHERE ${where}
             AND map IS NOT NULL
           ORDER BY value`
				)
				.bind(bindings)
				.all(mapRows);

			const playerRows = arrayOf(new DynamicModel({ profile_id: '', alias: '' }));
			$app
				.db()
				.newQuery(
					`SELECT DISTINCT
             json_extract(p.value, '$.profile_id') AS profile_id,
             json_extract(p.value, '$.alias') AS alias
           FROM lobbies l, json_each(l.lobbyPlayers) AS p
           WHERE ${where}
             AND l.lobbyPlayers IS NOT NULL
             AND l.lobbyPlayers != '[]'
             AND json_extract(p.value, '$.profile_id') IS NOT NULL
           UNION
           SELECT DISTINCT
             json_extract(p.value, '$.profile.profile_id') AS profile_id,
             json_extract(p.value, '$.profile.alias') AS alias
           FROM lobbies l, json_each(l.players) AS p
           WHERE ${where}
             AND (l.lobbyPlayers IS NULL OR l.lobbyPlayers = '[]')
             AND json_extract(p.value, '$.profile.profile_id') IS NOT NULL`
				)
				.bind(bindings)
				.all(playerRows);

			const maps = mapRows.map((row) => row.value);
			const players = playerRows.map((row) => ({
				profile_id: Number(row.profile_id),
				alias: row.alias
			}));

			try {
				const collection = $app.findCollectionByNameOrId('match_filter_snapshots');
				let snapshot;

				try {
					snapshot = $app.findRecordById('match_filter_snapshots', snapshotId);
					snapshot.set('maps', maps);
					snapshot.set('players', players);
				} catch {
					snapshot = new Record(collection);
					snapshot.set('id', snapshotId);
					snapshot.set('maps', maps);
					snapshot.set('players', players);
				}

				$app.save(snapshot);
			} catch {
				// Snapshot write failed; still return computed filters.
			}

			return e.json(200, { maps, players });
		}

		return e.json(400, { message: 'invalid scope' });
	} catch (error) {
		return e.json(400, { message: String(error?.message || error) });
	}
});

routerAdd('GET', '/api/replay-filters', (e) => {
	const userId = e.request.url.query().get('userId');

	if (!userId) {
		return e.json(400, { message: 'userId required' });
	}

	try {
		const bindings = { userId };

		const mapRows = arrayOf(new DynamicModel({ value: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT mapName AS value
         FROM replays
         WHERE createdBy = {:userId}
           AND mapName IS NOT NULL
           AND mapName != ''
         ORDER BY value`
			)
			.bind(bindings)
			.all(mapRows);

		const playerRows = arrayOf(new DynamicModel({ value: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT json_extract(player.value, '$.name') AS value
         FROM replays r, json_each(r.players) AS player
         WHERE r.createdBy = {:userId}
           AND json_extract(player.value, '$.name') IS NOT NULL
           AND json_extract(player.value, '$.name') != ''`
			)
			.bind(bindings)
			.all(playerRows);

		return e.json(200, {
			maps: mapRows.map((row) => row.value),
			players: playerRows.map((row) => ({ name: row.value }))
		});
	} catch (error) {
		return e.json(400, { message: String(error?.message || error) });
	}
});
