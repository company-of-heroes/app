'use strict';

const SMURF_COLLECTION = 'smurf_watch';
const TERMINAL_STATUSES = ['resolved', 'not_smurf'];
const SOURCE_PRIORITY = {
	lobby_live: 100,
	profile: 75,
	search: 70,
	lobby_match: 50,
	backfill: 10
};

function getServiceToken() {
	return $os.getenv('SMURF_SERVICE_TOKEN') || '';
}

function isServiceRequest(e) {
	const token = getServiceToken();
	if (!token) {
		return false;
	}

	const auth = e.request.header.get('Authorization') || '';
	return auth === `Bearer ${token}`;
}

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
		if (TERMINAL_STATUSES.includes(status)) {
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

function enqueueLobbyMatchRecord(e) {
	const players = e.record.get('lobbyPlayers') || parsePlayers(e.record.get('players'));
	enqueueLobbyPlayers(players, 'lobby_match');
}

function enqueueLobbyLiveRecord(e) {
	const players = parsePlayers(e.record.get('players'));
	enqueueLobbyPlayers(players, 'lobby_live');
}

function handleEnqueue(e) {
	const bodyInfo = $apis.requestInfo(e);
	const body = bodyInfo?.body || {};
	const lenderSteamId = body.lender_steam_id || body.lenderSteamId || null;

	if (lenderSteamId && !isServiceRequest(e) && !e.auth?.id) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const steamId = body.steam_id || body.steamId;
	const profileId = body.profile_id ?? body.profileId ?? null;
	const source = body.source || 'profile';
	const priority = body.priority ?? SOURCE_PRIORITY[source] ?? 50;
	const lenderSource = body.lender_source || body.lenderSource || null;

	if (!steamId) {
		return e.json(400, { message: 'steam_id is required' });
	}

	const existing = findSmurfWatchBySteamId(String(steamId));

	if (lenderSteamId && (isServiceRequest(e) || e.auth?.id)) {
		const collection = $app.findCollectionByNameOrId(SMURF_COLLECTION);
		const record = existing || new Record(collection);

		if (!existing) {
			record.set('steam_id', String(steamId));
			record.set('source', source);
		}

		record.set('status', 'resolved');
		record.set('lender_steam_id', String(lenderSteamId));
		record.set('lender_source', lenderSource || 'live');
		record.set('last_checked_at', new Date().toISOString());
		record.set('next_check_at', null);

		if (profileId != null) {
			record.set('profile_id', profileId);
		}

		$app.save(record);

		return e.json(200, {
			id: record.id,
			steam_id: record.get('steam_id'),
			status: record.get('status'),
			lender_steam_id: record.get('lender_steam_id')
		});
	}

	const record = upsertSmurfWatchEntry({
		steamId: String(steamId),
		profileId,
		source,
		priority
	});

	return e.json(200, {
		id: record?.id,
		steam_id: record?.get('steam_id'),
		status: record?.get('status'),
		lender_steam_id: record?.get('lender_steam_id') || null
	});
}

function handleGetBySteamId(e) {
	const steamId = e.request.pathValue('steamId');
	if (!steamId || steamId === 'worker') {
		return e.json(400, { message: 'steamId is required' });
	}

	const record = findSmurfWatchBySteamId(steamId);
	if (!record) {
		return e.json(404, { message: 'Not found' });
	}

	return e.json(200, {
		id: record.id,
		steam_id: record.get('steam_id'),
		profile_id: record.get('profile_id'),
		status: record.get('status'),
		source: record.get('source'),
		lender_steam_id: record.get('lender_steam_id') || null,
		lender_source: record.get('lender_source') || null,
		owns_coh: record.get('owns_coh'),
		next_check_at: record.get('next_check_at')
	});
}

function handleWorkerBatch(e) {
	if (!isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const screeningLimit = Number(e.request.url.query().get('screeningLimit') || 10);
	const pollingLimit = Number(e.request.url.query().get('pollingLimit') || 30);
	const now = new Date().toISOString();

	const screening = arrayOf(
		new DynamicModel({
			id: '',
			steam_id: '',
			profile_id: nullInt(),
			status: '',
			source: '',
			priority: 0,
			check_interval_sec: 0,
			owns_coh: nullBool()
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT id, steam_id, profile_id, status, source, priority, check_interval_sec, owns_coh
       FROM smurf_watch
       WHERE status = 'pending_screening'
       ORDER BY priority DESC, next_check_at ASC
       LIMIT {:limit}`
		)
		.bind({ limit: screeningLimit })
		.all(screening);

	const polling = arrayOf(
		new DynamicModel({
			id: '',
			steam_id: '',
			profile_id: nullInt(),
			status: '',
			source: '',
			priority: 0,
			check_interval_sec: 0
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT id, steam_id, profile_id, status, source, priority, check_interval_sec
       FROM smurf_watch
       WHERE status = 'watching'
         AND (next_check_at IS NULL OR next_check_at <= {:now})
       ORDER BY priority DESC, next_check_at ASC
       LIMIT {:limit}`
		)
		.bind({ now, limit: pollingLimit })
		.all(polling);

	const totalPending = new DynamicModel({ count: 0 });
	$app
		.db()
		.newQuery(`SELECT COUNT(*) AS count FROM smurf_watch WHERE status = 'pending_screening'`)
		.one(totalPending);

	const totalWatchingDue = new DynamicModel({ count: 0 });
	$app
		.db()
		.newQuery(
			`SELECT COUNT(*) AS count
       FROM smurf_watch
       WHERE status = 'watching'
         AND (next_check_at IS NULL OR next_check_at <= {:now})`
		)
		.bind({ now })
		.one(totalWatchingDue);

	return e.json(200, {
		screening,
		polling,
		fetched_at: now,
		total_pending: Number(totalPending.count) || 0,
		total_watching_due: Number(totalWatchingDue.count) || 0
	});
}

function handleWorkerPatch(e) {
	if (!isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const id = e.request.pathValue('id');
	if (!id) {
		return e.json(400, { message: 'id is required' });
	}

	let body = {};
	try {
		body = $apis.requestInfo(e).body || {};
	} catch {
		body = {};
	}

	let record;
	try {
		record = $app.findRecordById(SMURF_COLLECTION, id);
	} catch {
		return e.json(404, { message: 'Not found' });
	}

	const fields = [
		'status',
		'lender_steam_id',
		'lender_source',
		'owns_coh',
		'last_checked_at',
		'next_check_at',
		'check_interval_sec',
		'priority'
	];

	for (const field of fields) {
		if (body[field] !== undefined) {
			record.set(field, body[field]);
		}
	}

	$app.save(record);

	return e.json(200, {
		id: record.id,
		steam_id: record.get('steam_id'),
		status: record.get('status'),
		lender_steam_id: record.get('lender_steam_id') || null
	});
}

module.exports = {
	isServiceRequest,
	enqueueLobbyMatchRecord,
	enqueueLobbyLiveRecord,
	handleEnqueue,
	handleGetBySteamId,
	handleWorkerBatch,
	handleWorkerPatch
};
