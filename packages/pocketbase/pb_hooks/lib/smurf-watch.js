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

function readRequestJsonBody(e) {
	try {
		const raw = toString(e.request.body);
		if (raw) {
			return JSON.parse(raw);
		}
	} catch (error) {
		console.log('[smurf_watch] failed to parse raw request body', String(error));
	}

	try {
		const body = e.requestInfo()?.body;
		if (body && typeof body === 'object') {
			return body;
		}
	} catch (error) {
		console.log('[smurf_watch] failed to read requestInfo body', String(error));
	}

	return {};
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
	const body = readRequestJsonBody(e);
	const lenderSteamId = body.lender_steam_id || body.lenderSteamId || null;

	if (lenderSteamId && !isServiceRequest(e) && !e.auth?.id) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const steamId = body.steam_id || body.steamId;
	const profileId = body.profile_id ?? body.profileId ?? null;
	const source = Object.prototype.hasOwnProperty.call(SOURCE_PRIORITY, body.source)
		? body.source
		: 'profile';
	const maxPriority = SOURCE_PRIORITY[source];
	const requestedPriority = Number(body.priority);
	const priority = Number.isFinite(requestedPriority)
		? Math.max(0, Math.min(requestedPriority, maxPriority))
		: maxPriority;
	const lenderSource = body.lender_source || body.lenderSource || null;

	if (!steamId || !/^\d{17}$/.test(String(steamId))) {
		return e.json(400, { message: 'steam_id must be a 17-digit SteamID64' });
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
		next_check_at: record.get('next_check_at'),
		smurf_score: record.get('smurf_score'),
		verdict: record.get('verdict') || null,
		signals: record.get('signals') || null,
		suspected_main_steam_id: record.get('suspected_main_steam_id') || null,
		main_confidence: record.get('main_confidence'),
		score_computed_at: record.get('score_computed_at') || null
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
			owns_coh: nullBool(),
			watching_since: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT id, steam_id, profile_id, status, source, priority, check_interval_sec, owns_coh,
              COALESCE(watching_since, '') AS watching_since
       FROM smurf_watch
       WHERE status IN ('pending_screening', 'unknown_private')
         AND (next_check_at IS NULL OR next_check_at <= {:now})
       ORDER BY priority DESC, next_check_at ASC
       LIMIT {:limit}`
		)
		.bind({ now, limit: screeningLimit })
		.all(screening);

	const polling = arrayOf(
		new DynamicModel({
			id: '',
			steam_id: '',
			profile_id: nullInt(),
			status: '',
			source: '',
			priority: 0,
			check_interval_sec: 0,
			watching_since: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT id, steam_id, profile_id, status, source, priority, check_interval_sec,
              COALESCE(watching_since, '') AS watching_since
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
		.newQuery(
			`SELECT COUNT(*) AS count FROM smurf_watch
       WHERE status IN ('pending_screening', 'unknown_private')
         AND (next_check_at IS NULL OR next_check_at <= {:now})`
		)
		.bind({ now })
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

	const body = readRequestJsonBody(e);

	if (Object.keys(body).length === 0) {
		console.log('[smurf_watch] worker patch received empty body', { id });
		return e.json(400, { message: 'Request body is required' });
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
		'priority',
		'watching_since',
		'account_created_at',
		'coh_playtime_min',
		'game_bans',
		'vac_banned',
		'relic_total_games',
		'relic_winrate',
		'relic_level',
		'signals',
		'smurf_score',
		'verdict',
		'score_computed_at',
		'main_candidates',
		'suspected_main_steam_id',
		'main_confidence'
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

function resolvePlayerMeta(profileId) {
	const row = new DynamicModel({ lobbyPlayers: '' });

	try {
		$app
			.db()
			.newQuery(
				`SELECT COALESCE(l.lobbyPlayers, '') AS lobbyPlayers
         FROM lobbies l
         JOIN lobby_player_index i ON i.lobby = l.id
         WHERE i.profile_id = {:pid}
         ORDER BY l.createdAt DESC
         LIMIT 1`
			)
			.bind({ pid: profileId })
			.one(row);
	} catch {
		return { alias: null, steam_id: null };
	}

	try {
		const players = JSON.parse(row.lobbyPlayers);
		const found = Array.isArray(players)
			? players.find((player) => Number(player?.profile_id) === Number(profileId))
			: null;

		return {
			alias: found?.alias || null,
			steam_id: found?.steamId ? String(found.steamId) : null
		};
	} catch {
		return { alias: null, steam_id: null };
	}
}

function handleCoplay(e) {
	if (!isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const profileId = Number(e.request.pathValue('profileId'));
	if (!profileId || Number.isNaN(profileId)) {
		return e.json(400, { message: 'profileId is required' });
	}

	const teammates = arrayOf(
		new DynamicModel({
			profile_id: 0,
			shared_lobbies: 0
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT i2.profile_id AS profile_id, COUNT(DISTINCT i2.lobby) AS shared_lobbies
       FROM lobby_player_index i1
       JOIN lobby_player_index i2 ON i1.lobby = i2.lobby AND i2.profile_id != i1.profile_id
       WHERE i1.profile_id = {:pid}
       GROUP BY i2.profile_id
       ORDER BY shared_lobbies DESC
       LIMIT 25`
		)
		.bind({ pid: profileId })
		.all(teammates);

	const secondOrder = arrayOf(
		new DynamicModel({
			profile_id: 0,
			shared_teammates: 0
		})
	);

	// Accounts that share >= 2 of the suspect's teammates but never played
	// with the suspect directly: typical main-account pattern.
	$app
		.db()
		.newQuery(
			`WITH direct AS (
         SELECT DISTINCT i2.profile_id
         FROM lobby_player_index i1
         JOIN lobby_player_index i2 ON i1.lobby = i2.lobby
         WHERE i1.profile_id = {:pid} AND i2.profile_id != {:pid}
       )
       SELECT i2.profile_id AS profile_id, COUNT(DISTINCT i1.profile_id) AS shared_teammates
       FROM lobby_player_index i1
       JOIN lobby_player_index i2 ON i1.lobby = i2.lobby AND i2.profile_id != i1.profile_id
       WHERE i1.profile_id IN (SELECT profile_id FROM direct)
         AND i2.profile_id != {:pid}
         AND i2.profile_id NOT IN (SELECT profile_id FROM direct)
       GROUP BY i2.profile_id
       HAVING COUNT(DISTINCT i1.profile_id) >= 2
       ORDER BY shared_teammates DESC
       LIMIT 25`
		)
		.bind({ pid: profileId })
		.all(secondOrder);

	const withMeta = (rows, extra) =>
		rows.map((row) => {
			const meta = resolvePlayerMeta(Number(row.profile_id));
			return {
				profile_id: Number(row.profile_id),
				steam_id: meta.steam_id,
				alias: meta.alias,
				...extra(row)
			};
		});

	return e.json(200, {
		profile_id: profileId,
		teammates: withMeta(teammates, (row) => ({ shared_lobbies: Number(row.shared_lobbies) })),
		candidates: withMeta(secondOrder, (row) => ({
			shared_teammates: Number(row.shared_teammates)
		}))
	});
}

module.exports = {
	isServiceRequest,
	enqueueLobbyMatchRecord,
	enqueueLobbyLiveRecord,
	handleEnqueue,
	handleGetBySteamId,
	handleWorkerBatch,
	handleWorkerPatch,
	handleCoplay
};
