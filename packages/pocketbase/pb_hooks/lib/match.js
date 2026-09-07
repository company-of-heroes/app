// Public community match (replay) page for coh1stats.com.
'use strict';

const {
	parseLobbyPlayersField,
	parseResultField,
	loadPlayerAliasMap,
	loadPlayersByLobbyIds,
	resolvePlayersForRow
} = require(`${__hooks}/lib/match-history.js`);
const { isHiddenLobby, isHiddenByTitle, isStaffAuth } = require(`${__hooks}/lib/hidden-matches.js`);
const { clientIp, limitCountRequest, TOO_MANY } = require(`${__hooks}/lib/download-rate-limit.js`);
const { detailPlayers } = require(`${__hooks}/lib/live-lobbies.js`);

function livePlayersForInProgress(rawPlayers, isRanked) {
	try {
		return detailPlayers(rawPlayers, isRanked);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[match] livePlayers failed:', message);
		return [];
	}
}

const HTTP_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];

function applyCors(e) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin, Authorization');
	} else {
		e.response.header().set('Vary', 'Authorization');
	}
	e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	e.response.header().set(
		'Access-Control-Allow-Headers',
		'Content-Type, X-Download-Visitor, Authorization'
	);
}

function jsonWithCors(e, status, body) {
	applyCors(e);
	if (status === 200) {
		e.response.header().set('Cache-Control', HTTP_CACHE_CONTROL);
	} else {
		e.response.header().set('Cache-Control', 'no-store');
	}
	return e.json(status, body);
}

function jsonNoStore(e, status, body) {
	applyCors(e);
	e.response.header().set('Cache-Control', 'no-store');
	return e.json(status, body);
}

function hasReplayFile(record) {
	const replay = record.get('replay');
	return !!record.get('hasReplay') || (typeof replay === 'string' && replay.length > 0);
}

function durationFromRecord(record, result) {
	const stored = Number(record.get('durationSeconds'));
	if (Number.isFinite(stored) && stored > 0) {
		return stored;
	}
	const start = Number(result?.startgametime);
	const end = Number(result?.completiontime);
	if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
		return end - start;
	}
	return null;
}

function userSteamIds(user) {
	const raw = user.get('steamIds');
	if (!raw) {
		return [];
	}
	if (Array.isArray(raw)) {
		return raw.map(String).filter(Boolean);
	}
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return parsed.map(String).filter(Boolean);
			}
		} catch {
			return raw ? [raw] : [];
		}
	}
	return [];
}

function playerSteamId(player) {
	if (!player) {
		return '';
	}
	const steam = String(player.steamId || '');
	if (steam) {
		return steam;
	}
	const name = String(player.name || '');
	if (name.startsWith('/steam/')) {
		return name.slice(7);
	}
	return '';
}

function submittedByFromRecord(record, result) {
	const userRef = record.get('user');
	const userId = userRef && typeof userRef === 'object' ? userRef.id : userRef;
	if (!userId) {
		return null;
	}

	let user;
	try {
		user = $app.findRecordById('users', String(userId));
	} catch {
		return null;
	}

	const steamIds = userSteamIds(user);
	if (!steamIds.length) {
		return null;
	}

	const players = result?.players || [];
	for (let i = 0; i < players.length; i++) {
		const player = players[i];
		const steam = playerSteamId(player);
		if (steam && steamIds.indexOf(steam) !== -1) {
			return {
				alias: String(player.alias || '').trim() || String(player.name || '').trim(),
				profileId: Number(player.profile_id) || 0,
				steamId: steam
			};
		}
	}

	return null;
}

function ownerLabelFromRecord(record) {
	const userRef = record.get('user');
	const userId = userRef && typeof userRef === 'object' ? userRef.id : userRef;
	if (!userId) {
		return null;
	}

	let user;
	try {
		user = $app.findRecordById('users', String(userId));
	} catch {
		return null;
	}

	const name = String(user.get('name') || '').trim();
	if (name) {
		return name;
	}

	const email = String(user.get('email') || '').trim();
	if (email) {
		return email;
	}

	return String(user.id || userId);
}

function loadMatchPage(id, options) {
	const includeHidden = !!(options && options.includeHidden);
	const auth = options && options.auth ? options.auth : null;
	let record;
	try {
		record = $app.findRecordById('lobbies', id);
	} catch {
		const error = new Error('Match not found');
		error.status = 404;
		throw error;
	}

	const hasReplay = hasReplayFile(record);
	const needsResult = !!record.get('needsResult');
	// Finished replay pages, or in-progress rows created at lobby start.
	if (!hasReplay && !needsResult) {
		const error = new Error('Match not found');
		error.status = 404;
		throw error;
	}

	if (!includeHidden && isHiddenLobby(record)) {
		const error = new Error('Match not found');
		error.status = 404;
		throw error;
	}

	const result = parseResultField(record.get('result'));
	const lobbyPlayers = record.get('lobbyPlayers');
	const row = {
		id: record.id,
		lobbyPlayers: typeof lobbyPlayers === 'string' ? lobbyPlayers : JSON.stringify(lobbyPlayers || []),
		playerProfileIdsCsv: record.get('playerProfileIdsCsv') || '',
		result: record.get('result')
	};
	const aliasMap = loadPlayerAliasMap('community', '');
	const playersByLobby = loadPlayersByLobbyIds([record.id], aliasMap);
	const players = resolvePlayersForRow(row, aliasMap, playersByLobby);
	const livePlayers = livePlayersForInProgress(record.get('players'), !!record.get('isRanked'));
	const likeCounts = require(`${__hooks}/lib/player-social.js`).loadLikeCountsBySteamIds(
		[]
			.concat(players.map((player) => player?.steamId).filter(Boolean))
			.concat(livePlayers.map((player) => player?.steamId).filter(Boolean))
	);
	require(`${__hooks}/lib/player-social.js`).attachLikeCountsToPlayers(players, likeCounts);
	require(`${__hooks}/lib/player-social.js`).attachLikeCountsToPlayers(livePlayers, likeCounts);

	const memberReplayRef = record.get('memberReplay');
	const memberReplayId = memberReplayRef
		? typeof memberReplayRef === 'object'
			? String(memberReplayRef.id || '')
			: String(memberReplayRef)
		: '';
	const userRef = record.get('user');
	const ownerId = userRef && typeof userRef === 'object' ? userRef.id : userRef;
	const isOwner = !!(auth && auth.id && ownerId && String(ownerId) === String(auth.id));

	const body = {
		id: record.id,
		map: record.get('map') || '',
		title: record.get('title') || '',
		isRanked: !!record.get('isRanked'),
		createdAt: record.get('createdAt') || '',
		durationSeconds: durationFromRecord(record, result),
		likeCount: Number(record.get('likeCount')) || 0,
		downloadCount: Number(record.get('downloadCount')) || 0,
		replay: record.get('replay') || '',
		hasReplay,
		needsResult,
		sessionId: Number(record.get('sessionId')) || 0,
		hidden: isHiddenLobby(record),
		hiddenByKeyword: isHiddenByTitle(record),
		submittedBy: submittedByFromRecord(record, result),
		players,
		livePlayers,
		result,
		memberReplayId: memberReplayId || null,
		canPublish: !!(isOwner && hasReplay && !memberReplayId)
	};

	if (includeHidden) {
		body.updatedAt = record.get('updatedAt') || record.get('updated') || '';
		body.owner = ownerLabelFromRecord(record);
	}

	return body;
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function handleGet(e) {
	const id = e.request.pathValue('id');
	if (!id) {
		return jsonWithCors(e, 400, { message: 'id is required' });
	}

	const includeHidden = isStaffAuth(e.auth);
	try {
		const body = loadMatchPage(id, { includeHidden, auth: e.auth });
		if (includeHidden) {
			return jsonNoStore(e, 200, body);
		}

		return jsonWithCors(e, 200, body);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = error?.status || 500;
		if (status === 404) {
			return jsonWithCors(e, 404, { message: 'Match not found' });
		}
		console.warn('[match] failed to load', id, message);
		return jsonWithCors(e, 500, { message: 'Failed to load match' });
	}
}

function visitorIdFromRequest(e) {
	const header = String(e.request.header.get('X-Download-Visitor') || '').trim();
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(header)) {
		return header.toLowerCase();
	}
	return '';
}

function hashFingerprint(kind, value) {
	return String($security.sha256(`${kind}:${value}`) || '').toLowerCase();
}

function fingerprintsForRequest(e) {
	const fingerprints = [];
	const ip = clientIp(e);
	if (ip) fingerprints.push(hashFingerprint('ip', ip));
	const visitorId = visitorIdFromRequest(e);
	if (visitorId) fingerprints.push(hashFingerprint('vid', visitorId));
	return fingerprints;
}

function fingerprintExists(lobbyId, fingerprint) {
	try {
		$app.findFirstRecordByFilter(
			'lobby_download_fingerprints',
			'lobby = {:lobby} && fingerprint = {:fingerprint}',
			{ lobby: lobbyId, fingerprint }
		);
		return true;
	} catch {
		return false;
	}
}

function saveFingerprints(lobbyId, fingerprints) {
	const collection = $app.findCollectionByNameOrId('lobby_download_fingerprints');
	let saved = 0;
	let firstId = '';
	for (const fingerprint of fingerprints) {
		try {
			const record = new Record(collection);
			record.set('lobby', lobbyId);
			record.set('fingerprint', fingerprint);
			$app.save(record);
			saved += 1;
			if (!firstId) {
				firstId = record.id;
			}
		} catch {
			// Unique index — another request stored this fingerprint first.
		}
	}
	return { saved, firstId };
}

function currentDownloadCount(id) {
	const lobby = $app.findRecordById('lobbies', id);
	return Number(lobby.get('downloadCount')) || 0;
}

function handleDownload(e) {
	const limited = limitCountRequest(e);
	if (!limited.ok) {
		e.response.header().set('Retry-After', String(limited.retryAfter || 1));
		return jsonNoStore(e, 429, { message: TOO_MANY, retryAfter: limited.retryAfter || 1 });
	}
	const id = e.request.pathValue('id');
	if (!id) {
		return jsonNoStore(e, 400, { message: 'id is required' });
	}

	try {
		loadMatchPage(id, { includeHidden: isStaffAuth(e.auth) });
	} catch (error) {
		const status = error?.status || 500;
		if (status === 404) {
			return jsonNoStore(e, 404, { message: 'Match not found' });
		}
		console.warn('[match] failed to record download', id, String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to record download' });
	}

	try {
		const fingerprints = fingerprintsForRequest(e);
		const count = currentDownloadCount(id);
		if (!fingerprints.length) {
			return jsonNoStore(e, 200, { downloadCount: count, counted: false });
		}
		if (fingerprints.some((fingerprint) => fingerprintExists(id, fingerprint))) {
			return jsonNoStore(e, 200, { downloadCount: count, counted: false });
		}
		const saved = saveFingerprints(id, fingerprints);
		if (!saved.saved) {
			return jsonNoStore(e, 200, { downloadCount: currentDownloadCount(id), counted: false });
		}
		const lobby = $app.findRecordById('lobbies', id);
		const next = (Number(lobby.get('downloadCount')) || 0) + 1;
		lobby.set('downloadCount', next);
		$app.save(lobby);
		if (saved.firstId) {
			try {
				require(`${__hooks}/lib/reputation.js`).awardReplayDownload({
					uploaderId: lobby.get('user'),
					downloaderId: '',
					sourceId: saved.firstId
				});
			} catch (error) {
				console.warn('[match] reputation download', String(error?.message || error));
			}
		}
		return jsonNoStore(e, 200, { downloadCount: next, counted: true });
	} catch (error) {
		console.warn('[match] failed to save download count', id, String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to record download' });
	}
}

module.exports = {
	handleGet,
	handleDownload,
	handleOptions,
	loadMatchPage
};
