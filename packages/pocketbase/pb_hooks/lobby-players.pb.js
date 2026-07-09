/// <reference path="../pb_data/types.d.ts" />

'use strict';

onRecordCreate((e) => {
	let players = e.record.get('players');
	if (!Array.isArray(players)) {
		if (typeof players === 'string') {
			try {
				const parsed = JSON.parse(players);
				players = Array.isArray(parsed) ? parsed : [];
			} catch {
				players = [];
			}
		} else {
			players = [];
		}
	}

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

	e.record.set('lobbyPlayers', summaries);
	e.record.set('playerProfileIdsCsv', ids.length > 0 ? `,${ids.join(',')},` : '');
	e.record.set('hasReplay', !!e.record.get('replay'));

	if (!e.record.get('needsResult') && e.record.get('title') !== 'Skirmish' && e.record.get('replay')) {
		try {
			const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
			const maps = snapshot.get('maps') || [];
			const snapshotPlayers = snapshot.get('players') || [];
			const map = e.record.get('map');

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

	e.next();
}, 'lobbies');

onRecordUpdate((e) => {
	let players = e.record.get('players');
	if (!Array.isArray(players)) {
		if (typeof players === 'string') {
			try {
				const parsed = JSON.parse(players);
				players = Array.isArray(parsed) ? parsed : [];
			} catch {
				players = [];
			}
		} else {
			players = [];
		}
	}

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

	e.record.set('lobbyPlayers', summaries);
	e.record.set('playerProfileIdsCsv', ids.length > 0 ? `,${ids.join(',')},` : '');
	e.record.set('hasReplay', !!e.record.get('replay'));

	if (!e.record.get('needsResult') && e.record.get('title') !== 'Skirmish' && e.record.get('replay')) {
		try {
			const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
			const maps = snapshot.get('maps') || [];
			const snapshotPlayers = snapshot.get('players') || [];
			const map = e.record.get('map');

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

	e.next();
}, 'lobbies');
