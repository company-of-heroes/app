'use strict';

const SMURF_COLLECTION = 'smurf_watch';
const SMURF_BACKFILL_BATCH_SIZE = 50;
const SMURF_BACKFILL_PAGE_KEY = 'smurf_watch_backfill_page';
const SMURF_BACKFILL_COMPLETE_KEY = 'smurf_watch_backfill_complete';
const SOURCE_PRIORITY = {
	lobby_live: 100,
	profile: 75,
	search: 70,
	lobby_match: 50,
	backfill: 10
};

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

function extractSteamPlayers(players) {
	const seen = {};
	const result = [];

	for (const player of players) {
		const steamId = player?.steamId || player?.steam_id;
		if (!steamId || seen[steamId]) {
			continue;
		}

		seen[steamId] = true;
		result.push({
			steamId: String(steamId),
			profileId: player?.profile?.profile_id ?? player?.profile_id ?? null
		});
	}

	return result;
}

function findSmurfWatchBySteamId(steamId) {
	try {
		return $app.findFirstRecordByFilter(SMURF_COLLECTION, `steam_id = {:steamId}`, {
			steamId
		});
	} catch {
		return null;
	}
}

function upsertSmurfWatchEntry({ steamId, profileId, source, priority }) {
	if (!steamId) {
		return null;
	}

	const existing = findSmurfWatchBySteamId(steamId);
	const now = new Date().toISOString();
	const resolvedPriority = priority ?? SOURCE_PRIORITY[source] ?? 0;

	if (existing) {
		const status = existing.get('status');
		if (status === 'resolved' || status === 'not_smurf') {
			return existing;
		}

		const currentPriority = existing.get('priority') || 0;
		if (resolvedPriority > currentPriority) {
			existing.set('priority', resolvedPriority);
			existing.set('source', source);
		}

		if (profileId != null && !existing.get('profile_id')) {
			existing.set('profile_id', profileId);
		}

		if (status !== 'pending_screening' && status !== 'watching') {
			existing.set('status', 'pending_screening');
		}

		existing.set('next_check_at', now);
		$app.save(existing);
		return existing;
	}

	const collection = $app.findCollectionByNameOrId(SMURF_COLLECTION);
	const record = new Record(collection);
	record.set('steam_id', steamId);
	record.set('status', 'pending_screening');
	record.set('source', source);
	record.set('priority', resolvedPriority);
	record.set('check_interval_sec', 300);
	record.set('next_check_at', now);

	if (profileId != null) {
		record.set('profile_id', profileId);
	}

	$app.save(record);
	return record;
}

function enqueueLobbyPlayers(players, source) {
	const steamPlayers = extractSteamPlayers(players);
	const priority = SOURCE_PRIORITY[source] ?? 50;

	for (const player of steamPlayers) {
		upsertSmurfWatchEntry({
			steamId: player.steamId,
			profileId: player.profileId,
			source,
			priority
		});
	}
}

function parseLobbyPlayersFromRow(row) {
	if (typeof row.lobbyPlayers === 'string' && row.lobbyPlayers.length > 2) {
		try {
			const parsed = JSON.parse(row.lobbyPlayers);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		} catch {
			// ignore invalid JSON
		}
	}

	if (typeof row.players === 'string' && row.players.length > 2) {
		try {
			const parsed = JSON.parse(row.players);
			if (Array.isArray(parsed)) {
				return parsed;
			}
		} catch {
			// ignore invalid JSON
		}
	}

	return [];
}

function isComplete() {
	return $app.store().get(SMURF_BACKFILL_COMPLETE_KEY) === true;
}

function runBatch() {
	try {
		$app.findCollectionByNameOrId(SMURF_COLLECTION);
	} catch {
		return { processed: 0, enqueued: 0, complete: true };
	}

	if (isComplete()) {
		return { processed: 0, enqueued: 0, complete: true };
	}

	const page = Number($app.store().get(SMURF_BACKFILL_PAGE_KEY) || 1);
	const offset = (page - 1) * SMURF_BACKFILL_BATCH_SIZE;

	const rows = arrayOf(
		new DynamicModel({
			id: '',
			lobbyPlayers: '',
			players: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT
				id,
				COALESCE(lobbyPlayers, '') AS lobbyPlayers,
				COALESCE(players, '') AS players
			FROM lobbies
			ORDER BY createdAt ASC
			LIMIT {:limit} OFFSET {:offset}`
		)
		.bind({ limit: SMURF_BACKFILL_BATCH_SIZE, offset })
		.all(rows);

	if (rows.length === 0) {
		$app.store().set(SMURF_BACKFILL_COMPLETE_KEY, true);
		return { processed: 0, enqueued: 0, complete: true };
	}

	let enqueued = 0;

	for (const row of rows) {
		const players = parseLobbyPlayersFromRow(row);
		const before = extractSteamPlayers(players).length;
		enqueueLobbyPlayers(players, 'backfill');
		enqueued += before;
	}

	$app.store().set(SMURF_BACKFILL_PAGE_KEY, page + 1);

	if (rows.length < SMURF_BACKFILL_BATCH_SIZE) {
		$app.store().set(SMURF_BACKFILL_COMPLETE_KEY, true);
		return { processed: rows.length, enqueued, complete: true };
	}

	return { processed: rows.length, enqueued, complete: false };
}

function reset() {
	$app.store().set(SMURF_BACKFILL_COMPLETE_KEY, false);
	$app.store().set(SMURF_BACKFILL_PAGE_KEY, 1);
}

function getPage() {
	return Number($app.store().get(SMURF_BACKFILL_PAGE_KEY) || 1);
}

module.exports = {
	isComplete,
	runBatch,
	reset,
	getPage
};
