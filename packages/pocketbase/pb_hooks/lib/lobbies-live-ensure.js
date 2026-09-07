'use strict';

/**
 * Sole owner of in-progress durable `lobbies` rows for live games.
 * On every lobbies_live create/update: find-or-create by sessionId, set
 * lobbies_live.lobby. Clients must not create or link durable rows themselves.
 */

function toFiniteNumber(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function parsePlayers(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
}

function occupiedHumanCount(players) {
	let count = 0;
	for (const player of players) {
		const playerId = toFiniteNumber(player?.playerId);
		if (playerId == null || playerId <= 0) {
			continue;
		}

		count += 1;
	}

	return count;
}

function titleFromLive(record) {
	const matchType = toFiniteNumber(record.get('matchType'));
	if (matchType != null && matchType >= 1 && matchType <= 4) {
		return `${matchType} VS. ${matchType}`;
	}

	if (matchType === 14) {
		return 'Skirmish';
	}

	const humans = occupiedHumanCount(parsePlayers(record.get('players')));
	if (humans >= 2) {
		const side = Math.max(1, Math.floor(humans / 2));
		return `${side} VS. ${side}`;
	}

	return record.get('isRanked') ? 'Basic Match' : 'Custom Game';
}

function findLobbyBySessionId(sessionId) {
	try {
		return $app.findFirstRecordByFilter('lobbies', `sessionId=${sessionId}`);
	} catch {
		return null;
	}
}

function createDurableLobby(liveRecord, sessionId) {
	const collection = $app.findCollectionByNameOrId('lobbies');
	const record = new Record(collection);
	const user = liveRecord.get('user');
	if (user) {
		record.set('user', user);
	}

	record.set('sessionId', sessionId);
	record.set('map', liveRecord.get('map') || 'Unknown');
	record.set('isRanked', !!liveRecord.get('isRanked'));
	record.set('title', titleFromLive(liveRecord));
	record.set('needsResult', true);
	record.set('players', liveRecord.get('players') || []);
	$app.save(record);
	return record;
}

function syncInProgressLobby(durable, liveRecord) {
	if (!durable.get('needsResult')) {
		return durable;
	}

	durable.set('map', liveRecord.get('map') || durable.get('map') || 'Unknown');
	durable.set('isRanked', !!liveRecord.get('isRanked'));
	durable.set('players', liveRecord.get('players') || []);
	if (!String(durable.get('title') || '').trim()) {
		durable.set('title', titleFromLive(liveRecord));
	}

	$app.save(durable);
	return durable;
}

function lobbyRelationId(value) {
	if (!value) {
		return '';
	}

	if (typeof value === 'object') {
		return String(value.id || '');
	}

	return String(value);
}

/**
 * Mutates `liveRecord` to set `lobby` before the lobbies_live save commits.
 * Call from onRecordCreate / onRecordUpdate (before e.next()).
 */
function ensureDurableLobby(liveRecord) {
	if (!liveRecord || liveRecord.get('isReplay')) {
		return null;
	}

	const sessionId = toFiniteNumber(liveRecord.get('sessionId'));
	if (sessionId == null || !Number.isInteger(sessionId) || sessionId <= 0) {
		return null;
	}

	let durable = findLobbyBySessionId(sessionId);
	if (!durable) {
		try {
			durable = createDurableLobby(liveRecord, sessionId);
		} catch (error) {
			durable = findLobbyBySessionId(sessionId);
			if (!durable) {
				console.warn('[lobbies_live] ensure durable lobby failed:', error);
				return null;
			}
		}
	} else {
		try {
			durable = syncInProgressLobby(durable, liveRecord);
		} catch (error) {
			console.warn('[lobbies_live] sync durable lobby failed:', error);
		}
	}

	const durableId = String(durable.id || '');
	if (!durableId) {
		return null;
	}

	if (lobbyRelationId(liveRecord.get('lobby')) !== durableId) {
		liveRecord.set('lobby', durableId);
	}

	return durable;
}

module.exports = {
	ensureDurableLobby,
	titleFromLive
};
