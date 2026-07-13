'use strict';

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
	const uniqueIds = [
		...new Set(profileIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))
	];

	for (const profileId of uniqueIds) {
		const record = new Record(collection);
		record.set('lobby', lobbyId);
		record.set('profile_id', profileId);
		$app.save(record);
	}
}

function updateCommunitySnapshot(summaries, map) {
	if (!map && summaries.length === 0) {
		return;
	}

	try {
		const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
		const maps = snapshot.get('maps') || [];
		const snapshotPlayers = snapshot.get('players') || [];

		if (map && !maps.includes(map)) {
			maps.push(map);
			maps.sort();
		}

		for (const summary of summaries) {
			if (!snapshotPlayers.some((player) => player.profile_id === summary.profile_id)) {
				snapshotPlayers.push(summary);
			}
		}

		snapshotPlayers.sort((a, b) => String(a.alias).localeCompare(String(b.alias)));
		snapshot.set('maps', maps);
		snapshot.set('players', snapshotPlayers);
		$app.save(snapshot);
	} catch {
		// snapshot not ready yet
	}
}

function processLobbyRecord(e) {
	const players = parsePlayers(e.record.get('players'));
	const { summaries, csv, ids } = summarizeLobbyPlayers(players);

	e.record.set('lobbyPlayers', summaries);
	e.record.set('playerProfileIdsCsv', csv);
	e.record.set('hasReplay', !!e.record.get('replay'));

	if (
		!e.record.get('needsResult') &&
		e.record.get('title') !== 'Skirmish' &&
		e.record.get('replay')
	) {
		updateCommunitySnapshot(summaries, e.record.get('map'));
	}

	return ids;
}

function syncLobbyPlayerIndexForRecord(e) {
	const summaries = e.record.get('lobbyPlayers') || [];
	syncLobbyPlayerIndex(
		e.record.id,
		summaries.map((player) => player.profile_id)
	);
}

function isServiceRequest(e) {
	const token = $os.getenv('SMURF_SERVICE_TOKEN') || '';
	if (!token) {
		return false;
	}

	const auth = e.request.header.get('Authorization') || '';
	return auth === `Bearer ${token}`;
}

module.exports = {
	processLobbyRecord,
	syncLobbyPlayerIndexForRecord,
	isServiceRequest
};
