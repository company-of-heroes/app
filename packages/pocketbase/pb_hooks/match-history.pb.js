/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('GET', '/api/match-history', (e) => {
	const query = e.request.url.query();

	const scope = query.get('scope') || 'user';

	const userId = query.get('userId') || '';

	const page = Math.max(1, parseInt(query.get('page') || '1', 10) || 1);

	const perPage = Math.min(50, Math.max(1, parseInt(query.get('perPage') || '15', 10) || 15));

	const ranked = query.get('ranked') === 'true';

	const playerIds = (query.get('playerIds') || '')

		.split(',')

		.map((value) => value.trim())

		.filter(Boolean);

	const maps = (query.get('maps') || '')

		.split(',')

		.map((value) => value.trim())

		.filter(Boolean);

	const bindings = {};

	let where = "needsResult = 0 AND title != 'Skirmish'";

	if (scope === 'community') {
		where += " AND (hasReplay = 1 OR (replay IS NOT NULL AND replay != ''))";
	} else {
		if (!userId) {
			return e.json(400, { message: 'userId required for user scope' });
		}

		bindings.userId = userId;

		where += ' AND user = {:userId}';
	}

	if (ranked) {
		where += ' AND isRanked = 1';
	}

	if (maps.length > 0) {
		const mapClauses = [];

		for (let i = 0; i < maps.length; i++) {
			const key = `map${i}`;

			bindings[key] = maps[i];

			mapClauses.push(`map = {:${key}}`);
		}

		where += ` AND (${mapClauses.join(' OR ')})`;
	}

	if (playerIds.length > 0) {
		const playerClauses = [];

		for (let i = 0; i < playerIds.length; i++) {
			const csvKey = `pidCsv${i}`;

			const profileKey = `pidProfile${i}`;

			bindings[csvKey] = `%,${playerIds[i]},%`;

			bindings[profileKey] = Number(playerIds[i]);

			playerClauses.push(
				`(playerProfileIdsCsv LIKE {:${csvKey}} OR EXISTS (

          SELECT 1

          FROM json_each(lobbies.players) AS player

          WHERE json_extract(player.value, '$.profile.profile_id') = {:${profileKey}}

        ))`
			);
		}

		where += ` AND (${playerClauses.join(' OR ')})`;
	}

	const offset = (page - 1) * perPage;

	bindings.limit = perPage;

	bindings.offset = offset;

	const canUseCommunityCountCache =
		scope === 'community' && !ranked && playerIds.length === 0 && maps.length === 0;

	try {
		let totalItems = null;

		if (canUseCommunityCountCache) {
			try {
				const snapshot = $app.findRecordById('match_filter_snapshots', 'community');

				const matchCount = snapshot.get('matchCount');

				if (matchCount != null && Number(matchCount) > 0) {
					totalItems = Number(matchCount);
				}
			} catch {
				// snapshot not ready
			}
		}

		if (totalItems === null) {
			const countRow = new DynamicModel({ total: 0 });

			$app

				.db()

				.newQuery(`SELECT COUNT(*) AS total FROM lobbies WHERE ${where}`)

				.bind(bindings)

				.one(countRow);

			totalItems = Number(countRow.total) || 0;

			if (canUseCommunityCountCache) {
				try {
					const snapshot = $app.findRecordById('match_filter_snapshots', 'community');

					snapshot.set('matchCount', totalItems);

					$app.save(snapshot);
				} catch {
					// cache write failed
				}
			}
		}

		const itemRows = arrayOf(
			new DynamicModel({
				id: '',

				map: '',

				title: '',

				result: '',

				createdAt: '',

				isRanked: false,

				sessionId: 0,

				needsResult: false,

				lobbyPlayers: ''
			})
		);

		$app

			.db()

			.newQuery(
				`SELECT

           id,

           map,

           title,

           COALESCE(result, '') AS result,

           createdAt,

           isRanked,

           sessionId,

           needsResult,

           COALESCE(lobbyPlayers, '[]') AS lobbyPlayers

         FROM lobbies

         WHERE ${where}

         ORDER BY createdAt DESC

         LIMIT {:limit} OFFSET {:offset}`
			)

			.bind(bindings)

			.all(itemRows);

		const items = [];

		const fallbackIds = [];

		for (const row of itemRows) {
			let lobbyPlayersRaw = [];

			if (typeof row.lobbyPlayers === 'string' && row.lobbyPlayers.length > 0) {
				try {
					const parsed = JSON.parse(row.lobbyPlayers);

					lobbyPlayersRaw = Array.isArray(parsed) ? parsed : [];
				} catch {
					lobbyPlayersRaw = [];
				}
			} else if (Array.isArray(row.lobbyPlayers)) {
				lobbyPlayersRaw = row.lobbyPlayers;
			}

			const players = [];

			for (const player of lobbyPlayersRaw) {
				const profileId =
					player?.profile_id != null
						? Number(player.profile_id)
						: player?.profile?.profile_id != null
							? Number(player.profile.profile_id)
							: null;

				if (profileId == null) {
					continue;
				}

				players.push({
					playerId: player?.playerId != null ? Number(player.playerId) : null,

					steamId: player?.steamId ?? null,

					race: player?.race != null ? Number(player.race) : null,

					profile: {
						profile_id: profileId,

						alias: player?.alias ?? player?.profile?.alias ?? ''
					}
				});
			}

			let hasTeamData = false;

			for (const player of players) {
				if (player.race != null) {
					hasTeamData = true;

					break;
				}
			}

			if (!hasTeamData) {
				fallbackIds.push(row.id);
			}

			let result = null;

			if (typeof row.result === 'string' && row.result.length > 0) {
				try {
					result = JSON.parse(row.result);
				} catch {
					result = null;
				}
			} else if (row.result && typeof row.result === 'object') {
				result = row.result;
			}

			items.push({
				id: row.id,

				map: row.map,

				title: row.title,

				result,

				createdAt: row.createdAt,

				isRanked: !!row.isRanked,

				sessionId: row.sessionId,

				needsResult: !!row.needsResult,

				players
			});
		}

		if (fallbackIds.length > 0) {
			const fallbackBindings = {};

			const idClauses = [];

			for (let i = 0; i < fallbackIds.length; i++) {
				const key = `fallbackId${i}`;

				fallbackBindings[key] = fallbackIds[i];

				idClauses.push(`id = {:${key}}`);
			}

			const fallbackRows = arrayOf(new DynamicModel({ id: '', players: '' }));

			$app

				.db()

				.newQuery(
					`SELECT id, players

           FROM lobbies

           WHERE ${idClauses.join(' OR ')}`
				)

				.bind(fallbackBindings)

				.all(fallbackRows);

			const playersById = {};

			for (const row of fallbackRows) {
				let playersRaw = [];

				if (typeof row.players === 'string' && row.players.length > 0) {
					try {
						const parsed = JSON.parse(row.players);

						playersRaw = Array.isArray(parsed) ? parsed : [];
					} catch {
						playersRaw = [];
					}
				} else if (Array.isArray(row.players)) {
					playersRaw = row.players;
				}

				const summarized = [];

				for (const player of playersRaw) {
					const profileId =
						player?.profile?.profile_id != null ? Number(player.profile.profile_id) : null;

					if (profileId == null) {
						continue;
					}

					summarized.push({
						playerId: player?.playerId != null ? Number(player.playerId) : null,

						steamId: player?.steamId ?? null,

						race: player?.race != null ? Number(player.race) : null,

						profile: {
							profile_id: profileId,

							alias: player?.profile?.alias ?? ''
						}
					});
				}

				playersById[row.id] = summarized;
			}

			for (const item of items) {
				if (playersById[item.id]) {
					item.players = playersById[item.id];
				}
			}
		}

		return e.json(200, {
			page,

			perPage,

			totalItems,

			totalPages: totalItems > 0 ? Math.ceil(totalItems / perPage) : 0,

			items
		});
	} catch (error) {
		return e.json(400, { message: String(error?.message || error) });
	}
});
