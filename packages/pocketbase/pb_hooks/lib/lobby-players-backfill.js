'use strict';

const LOBBY_BACKFILL_BATCH_SIZE = 50;
const LOBBY_BACKFILL_PAGE_KEY = 'lobby_players_backfill_page';
const LOBBY_BACKFILL_COMPLETE_KEY = 'lobby_players_backfill_complete';

function parsePlayers(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
}

function summarizeLobbyPlayers(players) {
	const summaries = [];
	const ids = [];

	for (const player of players) {
		const profileId = player?.profile?.profile_id;
		if (profileId == null) {
			continue;
		}

		ids.push(profileId);
		summaries.push({
			profile_id: profileId,
			alias: player?.profile?.alias ?? '',
			playerId: player?.playerId ?? null,
			steamId: player?.steamId ?? null,
			race: player?.race ?? null
		});
	}

	return {
		summaries,
		csv: ids.length > 0 ? `,${ids.join(',')},` : '',
		ids
	};
}

function syncLobbyPlayerIndex(lobbyId, profileIds) {
	try {
		$app.findCollectionByNameOrId('lobby_player_index');
	} catch {
		return;
	}

	$app
		.db()
		.newQuery('DELETE FROM lobby_player_index WHERE lobby = {:lobbyId}')
		.bind({ lobbyId })
		.execute();

	if (!profileIds || profileIds.length === 0) {
		return;
	}

	const collection = $app.findCollectionByNameOrId('lobby_player_index');
	const uniqueIds = [...new Set(profileIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];

	for (const profileId of uniqueIds) {
		const record = new Record(collection);
		record.set('lobby', lobbyId);
		record.set('profile_id', profileId);
		$app.save(record);
	}
}

function parseLobbyPlayersField(raw) {
	const players = parsePlayers(raw);
	if (players.length === 0) {
		return [];
	}

	if (players[0]?.profile_id != null) {
		return players;
	}

	return summarizeLobbyPlayers(players).summaries;
}

function isComplete() {
	return $app.store().get(LOBBY_BACKFILL_COMPLETE_KEY) === true;
}

function backfillLobbyFromRow(row) {
	const players = parsePlayers(row.players);
	const existingSummaries = parseLobbyPlayersField(row.lobbyPlayers);
	const { summaries, csv, ids } =
		existingSummaries.length > 0
			? {
					summaries: existingSummaries,
					csv:
						typeof row.playerProfileIdsCsv === 'string' && row.playerProfileIdsCsv.length > 0
							? row.playerProfileIdsCsv
							: existingSummaries.length > 0
								? `,${existingSummaries.map((player) => player.profile_id).join(',')},`
								: '',
					ids: existingSummaries.map((player) => player.profile_id)
				}
			: summarizeLobbyPlayers(players);

	const needsLobbyUpdate =
		existingSummaries.length === 0 &&
		(typeof row.lobbyPlayers !== 'string' ||
			row.lobbyPlayers.length <= 2 ||
			!row.playerProfileIdsCsv);

	if (needsLobbyUpdate && summaries.length > 0) {
		const record = $app.findRecordById('lobbies', row.id);
		record.set('lobbyPlayers', summaries);
		record.set('playerProfileIdsCsv', csv);
		record.set('hasReplay', Boolean(row.replay));
		$app.save(record);
	}

	syncLobbyPlayerIndex(row.id, ids.length > 0 ? ids : summaries.map((player) => player.profile_id));

	return { updated: needsLobbyUpdate && summaries.length > 0, indexed: ids.length > 0 || summaries.length > 0 };
}

function runBatch() {
	const page = Number($app.store().get(LOBBY_BACKFILL_PAGE_KEY) || 1);
	const offset = (page - 1) * LOBBY_BACKFILL_BATCH_SIZE;

	if (isComplete()) {
		return { processed: 0, updated: 0, indexed: 0, complete: true };
	}

	const rows = arrayOf(
		new DynamicModel({
			id: '',
			players: '',
			lobbyPlayers: '',
			playerProfileIdsCsv: '',
			replay: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT
				id,
				COALESCE(players, '') AS players,
				COALESCE(lobbyPlayers, '') AS lobbyPlayers,
				COALESCE(playerProfileIdsCsv, '') AS playerProfileIdsCsv,
				COALESCE(replay, '') AS replay
			FROM lobbies
			ORDER BY createdAt ASC
			LIMIT {:limit} OFFSET {:offset}`
		)
		.bind({ limit: LOBBY_BACKFILL_BATCH_SIZE, offset })
		.all(rows);

	if (rows.length === 0) {
		$app.store().set(LOBBY_BACKFILL_COMPLETE_KEY, true);
		return { processed: 0, updated: 0, indexed: 0, complete: true };
	}

	let updated = 0;
	let indexed = 0;

	for (const row of rows) {
		const result = backfillLobbyFromRow(row);
		if (result.updated) {
			updated += 1;
		}
		if (result.indexed) {
			indexed += 1;
		}
	}

	$app.store().set(LOBBY_BACKFILL_PAGE_KEY, page + 1);

	if (rows.length < LOBBY_BACKFILL_BATCH_SIZE) {
		$app.store().set(LOBBY_BACKFILL_COMPLETE_KEY, true);
		return { processed: rows.length, updated, indexed, complete: true };
	}

	return { processed: rows.length, updated, indexed, complete: false };
}

function reset() {
	$app.store().set(LOBBY_BACKFILL_COMPLETE_KEY, false);
	$app.store().set(LOBBY_BACKFILL_PAGE_KEY, 1);
}

function getPage() {
	return Number($app.store().get(LOBBY_BACKFILL_PAGE_KEY) || 1);
}

module.exports = {
	isComplete,
	runBatch,
	reset,
	getPage
};
