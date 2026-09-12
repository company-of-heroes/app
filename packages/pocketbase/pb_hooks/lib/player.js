// Public player page API for coh1stats.com. Requires STEAM_API_KEY.
'use strict';

const ratings = require(`${__hooks}/lib/player-ratings.js`);
const matchHistory = require(`${__hooks}/lib/match-history.js`);
const { emptyPerformance, loadPlayerPerformance } = require(`${__hooks}/lib/player-performance.js`);
const playerLabels = require(`${__hooks}/lib/player-labels.js`);

const RELIC_API_BASE = 'https://coh1-lobby.reliclink.com';
const STEAM_ID_REGEX = /^7656119\d{10}$/;
const COH_APP_ID = 228200;
const RANKED_LEADERBOARD_MIN = 4;
const RANKED_LEADERBOARD_MAX = 19;

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];

const LEADERBOARD_MODE_LABELS = {
	4: '1v1',
	5: '1v1',
	6: '1v1',
	7: '1v1',
	8: '2v2',
	9: '2v2',
	10: '2v2',
	11: '2v2',
	12: '3v3',
	13: '3v3',
	14: '3v3',
	15: '3v3',
	16: '4v4',
	17: '4v4',
	18: '4v4',
	19: '4v4',
	0: 'Basic Match',
	1: 'Basic Match',
	2: 'Basic Match',
	3: 'Basic Match',
	42: 'Skirmish',
	43: 'Skirmish',
	44: 'Skirmish',
	45: 'Skirmish',
	46: 'Operation Assault',
	47: 'Operation Assault',
	50: 'Operation Panzerkrieg',
	51: 'Operation Panzerkrieg',
	54: 'Operation Stonewall',
	55: 'Operation Stonewall'
};

const LEADERBOARD_FACTION_LABELS = {
	4: 'US',
	8: 'US',
	12: 'US',
	16: 'US',
	0: 'US',
	42: 'US',
	46: 'US',
	50: 'US',
	54: 'US',
	5: 'Wehrmacht',
	9: 'Wehrmacht',
	13: 'Wehrmacht',
	17: 'Wehrmacht',
	1: 'Wehrmacht',
	43: 'Wehrmacht',
	47: 'Wehrmacht',
	51: 'Wehrmacht',
	55: 'Wehrmacht',
	6: 'Brits',
	10: 'Brits',
	14: 'Brits',
	18: 'Brits',
	2: 'Brits',
	44: 'Brits',
	7: 'Panzer Elite',
	11: 'Panzer Elite',
	15: 'Panzer Elite',
	19: 'Panzer Elite',
	3: 'Panzer Elite',
	45: 'Panzer Elite'
};

function isSteamId(value) {
	return typeof value === 'string' && STEAM_ID_REGEX.test(value);
}

function isProfileId(value) {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 && !isSteamId(String(value));
}

function isRankedLeaderboard(leaderboardId) {
	return leaderboardId >= RANKED_LEADERBOARD_MIN && leaderboardId <= RANKED_LEADERBOARD_MAX;
}

function steamIdFromName(name) {
	if (typeof name !== 'string') {
		return '';
	}
	return name.replace('/steam/', '');
}

function logInfo(message, attrs) {
	const pairs = ['source', 'player'];
	appendLogAttrs(pairs, attrs);
	$app.logger().info(message, ...pairs);
}

function logWarn(message, attrs) {
	const pairs = ['source', 'player'];
	appendLogAttrs(pairs, attrs);
	$app.logger().warn(message, ...pairs);
}

function logError(message, attrs) {
	const pairs = ['source', 'player'];
	appendLogAttrs(pairs, attrs);
	$app.logger().error(message, ...pairs);
}

function appendLogAttrs(pairs, attrs) {
	if (!attrs) {
		return;
	}

	for (const key in attrs) {
		if (!Object.prototype.hasOwnProperty.call(attrs, key)) {
			continue;
		}

		const value = attrs[key];
		if (value == null) {
			continue;
		}

		pairs.push(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
	}
}

function applyCors(e) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin');
	}
	e.response.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS');
	e.response.header().set('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonWithCors(e, status, body, cacheControl) {
	applyCors(e);
	if (cacheControl) {
		e.response.header().set('Cache-Control', cacheControl);
	}
	return e.json(status, body);
}

function parseHttpJson(response, context) {
	if (!response) {
		throw new Error('Empty HTTP response');
	}

	if (response.statusCode < 200 || response.statusCode >= 300) {
		logWarn('Player upstream HTTP error', {
			...context,
			statusCode: response.statusCode,
			rawPreview: (response.raw || '').slice(0, 200)
		});
		throw new Error(`Upstream HTTP ${response.statusCode}`);
	}

	if (response.json != null) {
		return response.json;
	}

	const raw = response.raw || '';
	if (!raw) {
		logWarn('Player upstream returned empty body', context);
		throw new Error('Empty HTTP body');
	}

	try {
		return JSON.parse(raw);
	} catch (error) {
		logError('Player failed to parse upstream JSON', {
			...context,
			error: error instanceof Error ? error.message : String(error),
			rawPreview: raw.slice(0, 200)
		});
		throw error;
	}
}

function fetchRelicJsonInsecure(url, context) {
	try {
		const raw = toString($os.cmd('python3', `${__hooks}/lib/fetch-insecure.py`, url).output());
		if (!raw) {
			throw new Error('Empty HTTP body');
		}
		return JSON.parse(raw);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logError('Player Relic fetch failed', {
			upstream: 'relic',
			...context,
			error: message
		});
		throw new Error(`Relic fetch failed: ${message}`);
	}
}

function fetchJsonMany(urls, context) {
	const unique = [];
	const seen = {};
	for (const url of urls) {
		if (!url || seen[url]) {
			continue;
		}
		seen[url] = true;
		unique.push(url);
	}

	if (unique.length === 0) {
		return {};
	}

	if (unique.length === 1) {
		return fetchJsonManySequential(unique, context);
	}

	try {
		const raw = toString(
			$os.cmd('python3', `${__hooks}/lib/fetch-insecure.py`, '--ndjson', JSON.stringify(unique)).output()
		);
		const byUrl = {};
		const lines = String(raw || '').split('\n');
		for (const line of lines) {
			if (!line.trim()) {
				continue;
			}
			try {
				const row = JSON.parse(line);
				if (row?.ok && row.url) {
					byUrl[row.url] = row.body;
				} else if (row?.url) {
					logWarn('Player parallel fetch item failed', {
						...context,
						urlHost: String(row.url).split('?')[0],
						error: row.error || 'unknown'
					});
				}
			} catch (error) {
				logWarn('Player parallel fetch line parse failed', {
					...context,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		if (Object.keys(byUrl).length === 0) {
			return fetchJsonManySequential(unique, context);
		}
		return byUrl;
	} catch (error) {
		logError('Player parallel fetch failed', {
			...context,
			error: error instanceof Error ? error.message : String(error)
		});
		return fetchJsonManySequential(unique, context);
	}
}

function fetchJsonManySequential(urls, context) {
	const byUrl = {};
	for (const url of urls) {
		try {
			byUrl[url] = fetchRelicJsonInsecure(url, context);
		} catch (error) {
			logWarn('Player sequential fetch item failed', {
				...context,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	return byUrl;
}

function relicPersonalStatUrlBySteamId(steamId) {
	return (
		`${RELIC_API_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_names=` +
		encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))
	);
}

function relicPersonalStatUrlById(profileId) {
	return (
		`${RELIC_API_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_ids=` +
		encodeURIComponent(JSON.stringify([Number(profileId)]))
	);
}

function relicPersonalStatUrlByIds(profileIds) {
	return (
		`${RELIC_API_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_ids=` +
		encodeURIComponent(JSON.stringify(profileIds.map(Number)))
	);
}

const PERSONAL_STAT_BATCH = 20;

/** Parse batch getpersonalstat → profile_id → leaderboardStats[]. */
function statsByProfileIdFromPersonalStat(data) {
	const byId = {};
	const allStats = data?.leaderboardStats ?? [];
	const groups = data?.statGroups ?? [];

	for (let i = 0; i < groups.length; i++) {
		const member = groups[i]?.members?.[0];
		if (!member) {
			continue;
		}

		const id = Number(member.profile_id);
		if (!Number.isInteger(id) || id <= 0) {
			continue;
		}

		byId[id] = allStats.filter((stat) => stat?.statgroup_id === member.personal_statgroup_id);
	}

	return byId;
}

/**
 * Fetch leaderboardStats for opponent profile ids (chunked Relic personalstat).
 * `seed` may already include the page owner's stats.
 */
function fetchLeaderboardStatsByProfileIds(profileIds, seed) {
	const byId = Object.assign({}, seed || {});
	const missing = [];

	for (let i = 0; i < (profileIds || []).length; i++) {
		const id = Number(profileIds[i]);
		if (!Number.isInteger(id) || id <= 0 || byId[id]) {
			continue;
		}

		missing.push(id);
	}

	if (missing.length === 0) {
		return byId;
	}

	const urls = [];
	for (let i = 0; i < missing.length; i += PERSONAL_STAT_BATCH) {
		urls.push(relicPersonalStatUrlByIds(missing.slice(i, i + PERSONAL_STAT_BATCH)));
	}

	const byUrl = fetchJsonMany(urls, { upstream: 'personalstat-batch', count: missing.length });
	for (let i = 0; i < urls.length; i++) {
		const body = byUrl[urls[i]];
		if (!body) {
			continue;
		}

		Object.assign(byId, statsByProfileIdFromPersonalStat(body));
	}

	return byId;
}

function enrichMatchHistoryWithRankLevels(matches, ownerProfileId, ownerStats) {
	if (!matches || matches.length === 0) {
		return matches || [];
	}

	const profileIds = matchHistory.collectMatchHistoryProfileIds(matches);
	const seed = {};
	const ownerId = Number(ownerProfileId);
	if (Number.isInteger(ownerId) && ownerId > 0 && Array.isArray(ownerStats)) {
		seed[ownerId] = ownerStats;
	}

	try {
		const statsByProfileId = fetchLeaderboardStatsByProfileIds(profileIds, seed);
		return matchHistory.attachMatchHistoryRankLevels(matches, statsByProfileId);
	} catch (error) {
		logWarn('Match history rank enrichment failed', {
			ownerProfileId,
			error: error instanceof Error ? error.message : String(error)
		});
		return matchHistory.attachMatchHistoryRankLevels(matches, seed);
	}
}

function relicMatchHistoryUrl(profileId) {
	return (
		`${RELIC_API_BASE}/community/leaderboard/getrecentmatchhistorybyprofileid` +
		`?title=coh1&profile_id=${encodeURIComponent(String(profileId))}`
	);
}

function steamApiKey() {
	return $os.getenv('STEAM_API_KEY') || $os.getenv('PUBLIC_STEAM_API_KEY') || '';
}

function steamSummariesUrl(steamId, apiKey) {
	return (
		'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?' +
		`key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`
	);
}

function steamPlaytimeUrl(steamId, apiKey) {
	return (
		'https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?' +
		`key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}`
	);
}

function steamPlayerFromBody(data) {
	return data?.response?.players?.[0] ?? null;
}

function steamPlaytimeFromBody(data) {
	const games = data?.response?.games ?? [];
	return games.find((game) => Number(game?.appid) === COH_APP_ID) ?? null;
}

function memberFromPersonalStat(data, steamId, profileId) {
	const members = data?.statGroups?.[0]?.members ?? [];
	const member = steamId
		? members.find((entry) => entry?.name === `/steam/${steamId}`)
		: members.find((entry) => Number(entry?.profile_id) === Number(profileId));

	if (!member) {
		return null;
	}

	const leaderboardStats = (data?.leaderboardStats ?? []).filter(
		(stat) => stat?.statgroup_id === member.personal_statgroup_id
	);

	return {
		profile_id: member.profile_id,
		alias: member.alias,
		country: member.country,
		level: member.level,
		name: member.name,
		personal_statgroup_id: member.personal_statgroup_id,
		leaderboardStats
	};
}

function fetchRelicProfileBySteamId(steamId) {
	const data = fetchRelicJsonInsecure(relicPersonalStatUrlBySteamId(steamId), { steamId });
	return memberFromPersonalStat(data, steamId, null);
}

function fetchRelicProfileById(profileId) {
	const data = fetchRelicJsonInsecure(relicPersonalStatUrlById(profileId), { profileId });
	return memberFromPersonalStat(data, null, profileId);
}

function fetchSteamProfile(steamId) {
	const apiKey = steamApiKey();
	if (!apiKey) {
		logError('STEAM_API_KEY is not configured', { steamId });
		throw new Error('STEAM_API_KEY is not configured');
	}

	const response = $http.send({
		url: steamSummariesUrl(steamId, apiKey),
		method: 'GET',
		timeout: 15
	});

	const data = parseHttpJson(response, { upstream: 'steam', steamId });
	return steamPlayerFromBody(data);
}

function fetchSteamPlaytime(steamId) {
	const apiKey = steamApiKey();
	if (!apiKey || !isSteamId(steamId)) {
		return null;
	}

	try {
		const response = $http.send({
			url: steamPlaytimeUrl(steamId, apiKey),
			method: 'GET',
			timeout: 15
		});

		const data = parseHttpJson(response, { upstream: 'steam-playtime', steamId });
		return steamPlaytimeFromBody(data);
	} catch (error) {
		logWarn('Player Steam playtime lookup failed', {
			steamId,
			error: error instanceof Error ? error.message : String(error)
		});
		return null;
	}
}

function matchesFromRelicBody(data, profileId) {
	try {
		const matches = matchHistory.transformMatchHistory(data, profileId);
		return require(`${__hooks}/lib/hidden-matches.js`).filterHiddenMatchHistory(matches);
	} catch (error) {
		logWarn('Player match history lookup failed', {
			profileId,
			error: error instanceof Error ? error.message : String(error)
		});
		return [];
	}
}

function fetchMatchHistory(profileId) {
	try {
		const data = fetchRelicJsonInsecure(relicMatchHistoryUrl(profileId), {
			profileId,
			upstream: 'match-history'
		});
		return matchesFromRelicBody(data, profileId);
	} catch (error) {
		logWarn('Player match history lookup failed', {
			profileId,
			error: error instanceof Error ? error.message : String(error)
		});
		return [];
	}
}

function loadElo(profileId) {
	try {
		const record = ratings.findByProfileId(profileId);
		if (!record) {
			return {};
		}
		return ratings.serializeRecord(record)?.elo ?? {};
	} catch (error) {
		logWarn('Player ratings lookup failed', {
			profileId,
			error: error instanceof Error ? error.message : String(error)
		});
		return {};
	}
}

function loadCommunityPerformance(profileId) {
	try {
		return loadPlayerPerformance(profileId, 'community', '', {});
	} catch (error) {
		logWarn('Player performance lookup failed', {
			profileId,
			error: error instanceof Error ? error.message : String(error)
		});
		return emptyPerformance();
	}
}

function peekResolvedSmurfLender(steamId) {
	try {
		const { findSmurfWatchBySteamId } = require(`${__hooks}/lib/smurf-watch.js`);
		const record = findSmurfWatchBySteamId(steamId);
		if (!record || record.get('status') !== 'resolved') {
			return null;
		}

		const lenderSteamId = String(record.get('lender_steam_id') || '');
		if (!isSteamId(lenderSteamId)) {
			return null;
		}

		return lenderSteamId;
	} catch (error) {
		logWarn('Smurf lookup failed', {
			steamId,
			error: error instanceof Error ? error.message : String(error)
		});
		return null;
	}
}

function smurfFromLenderSteam(lenderSteamId, lenderSteam) {
	if (!isSteamId(lenderSteamId)) {
		return null;
	}

	return {
		lenderSteamId,
		lenderProfileId: null,
		lenderAlias: lenderSteam?.personaname || 'Original account',
		lenderAvatarUrl: lenderSteam?.avatarfull || lenderSteam?.avatarmedium || null
	};
}

function loadSmurf(steamId) {
	const lenderSteamId = peekResolvedSmurfLender(steamId);
	if (!lenderSteamId) {
		return null;
	}

	let lenderSteam = null;
	try {
		lenderSteam = fetchSteamProfile(lenderSteamId);
	} catch (error) {
		logWarn('Smurf lender Steam lookup failed', {
			steamId,
			lenderSteamId,
			error: error instanceof Error ? error.message : String(error)
		});
	}

	return smurfFromLenderSteam(lenderSteamId, lenderSteam);
}

function selectCardStats(stats) {
	const sorted = [...(stats ?? [])].sort((a, b) => {
		const aRanked = isRankedLeaderboard(a.leaderboard_id) ? 0 : 1;
		const bRanked = isRankedLeaderboard(b.leaderboard_id) ? 0 : 1;
		if (aRanked !== bRanked) {
			return aRanked - bRanked;
		}
		return (b.ranklevel ?? 0) - (a.ranklevel ?? 0);
	});

	return sorted.map((stat) => ({
		leaderboardId: stat.leaderboard_id,
		modeLabel: LEADERBOARD_MODE_LABELS[stat.leaderboard_id] || 'Unknown',
		factionLabel: LEADERBOARD_FACTION_LABELS[stat.leaderboard_id] || 'Unknown',
		ranked: isRankedLeaderboard(stat.leaderboard_id),
		ranklevel: stat.ranklevel ?? 0,
		rank: stat.rank ?? 0,
		wins: stat.wins ?? 0,
		losses: stat.losses ?? 0,
		streak: stat.streak ?? 0
	}));
}

const PAGE_CACHE_TTL_MS = 45 * 1000;
const PAGE_CACHE_MAX = 40;
const PAGE_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=60';
const pageCache = {};

function nowMs() {
	return Number(new Date());
}

function readPageCache(key) {
	const hit = pageCache[key];
	if (!hit || nowMs() - hit.at > PAGE_CACHE_TTL_MS) {
		delete pageCache[key];
		return null;
	}
	return hit.value;
}

function writePageCache(key, value) {
	pageCache[key] = { at: nowMs(), value };
	const keys = Object.keys(pageCache);
	if (keys.length <= PAGE_CACHE_MAX) {
		return;
	}
	keys.sort((a, b) => (pageCache[a].at || 0) - (pageCache[b].at || 0));
	const remove = keys.length - PAGE_CACHE_MAX;
	for (let i = 0; i < remove; i++) {
		delete pageCache[keys[i]];
	}
}

function loadPlayerLikeCount(steamId) {
	const id = String(steamId || '').trim();
	if (!id) {
		return 0;
	}

	try {
		const row = $app.findFirstRecordByFilter('player_vote_scores', 'steamId = {:steamId}', {
			steamId: id
		});
		return Number(row.get('likeCount')) || 0;
	} catch {
		return 0;
	}
}

function withLikeCount(page) {
	return Object.assign({}, page, {
		likeCount: loadPlayerLikeCount(page.steamId)
	});
}

function loadPlayerPage(id, options) {
	const extras = options?.extras !== false;
	const cacheKey = `${id}:${extras ? 'full' : 'card'}`;
	const cached = readPageCache(cacheKey);
	if (cached) {
		return withLikeCount(cached);
	}

	const steamLookup = isSteamId(String(id));
	const profileLookup = isProfileId(String(id));

	if (!steamLookup && !profileLookup) {
		const error = new Error('Invalid player id');
		error.status = 400;
		throw error;
	}

	const apiKey = steamApiKey();
	if (!apiKey) {
		logError('STEAM_API_KEY is not configured', { id });
		throw new Error('STEAM_API_KEY is not configured');
	}

	let relicProfile = null;
	let steamProfile = null;
	let playtime = null;
	let playtimeFetched = !extras;
	let matchBody = null;
	let lenderSteam = null;

	if (steamLookup) {
		const relicUrl = relicPersonalStatUrlBySteamId(String(id));
		const summaryUrl = steamSummariesUrl(String(id), apiKey);
		const urls = [relicUrl, summaryUrl];
		let firstPlaytimeUrl = '';
		if (extras) {
			firstPlaytimeUrl = steamPlaytimeUrl(String(id), apiKey);
			urls.push(firstPlaytimeUrl);
		}
		const byUrl = fetchJsonMany(urls, { steamId: String(id) });
		relicProfile = memberFromPersonalStat(byUrl[relicUrl], String(id), null);
		steamProfile = steamPlayerFromBody(byUrl[summaryUrl]);
		if (extras) {
			playtime = steamPlaytimeFromBody(byUrl[firstPlaytimeUrl]);
			playtimeFetched = true;
		}
	} else {
		relicProfile = fetchRelicProfileById(Number(id));
	}

	if (!relicProfile) {
		const error = new Error('Player not found');
		error.status = 404;
		throw error;
	}

	const steamId = steamIdFromName(relicProfile.name) || (steamLookup ? String(id) : '');
	if (!isSteamId(steamId)) {
		const error = new Error('Player not found');
		error.status = 404;
		throw error;
	}

	const lenderSteamId = extras ? peekResolvedSmurfLender(steamId) : null;
	const followUp = [];
	const summaryUrl = steamSummariesUrl(steamId, apiKey);
	const playtimeUrl = steamPlaytimeUrl(steamId, apiKey);
	const historyUrl = relicMatchHistoryUrl(relicProfile.profile_id);
	let lenderSummaryUrl = '';

	if (!steamProfile) {
		followUp.push(summaryUrl);
	}
	if (extras && !playtimeFetched) {
		followUp.push(playtimeUrl);
	}
	if (extras) {
		followUp.push(historyUrl);
	}
	if (lenderSteamId) {
		lenderSummaryUrl = steamSummariesUrl(lenderSteamId, apiKey);
		followUp.push(lenderSummaryUrl);
	}

	if (followUp.length > 0) {
		const byUrl = fetchJsonMany(followUp, { steamId, profileId: relicProfile.profile_id });
		if (!steamProfile) {
			steamProfile = steamPlayerFromBody(byUrl[summaryUrl]);
		}
		if (extras && !playtimeFetched) {
			playtime = steamPlaytimeFromBody(byUrl[playtimeUrl]);
		}
		if (extras) {
			matchBody = byUrl[historyUrl] || null;
		}
		if (lenderSummaryUrl) {
			lenderSteam = steamPlayerFromBody(byUrl[lenderSummaryUrl]);
		}
	}

	if (!steamProfile) {
		const error = new Error('Player not found');
		error.status = 404;
		throw error;
	}

	const elo = extras ? loadElo(relicProfile.profile_id) : {};
	const performance = extras ? loadCommunityPerformance(relicProfile.profile_id) : emptyPerformance();
	const matches = extras
		? matchBody
			? matchesFromRelicBody(matchBody, relicProfile.profile_id)
			: fetchMatchHistory(relicProfile.profile_id)
		: [];
	const smurf = extras && lenderSteamId ? smurfFromLenderSteam(lenderSteamId, lenderSteam) : null;
	const labelsBySteamId = extras
		? playerLabels.loadLabelsBySteamIds([steamId, ...playerLabels.steamIdsFromMatches(matches)])
		: {};
	const likeCountsBySteamId = extras
		? require(`${__hooks}/lib/player-social.js`).loadLikeCountsBySteamIds([
				steamId,
				...playerLabels.steamIdsFromMatches(matches)
			])
		: {};
	const labeledMatches = extras ? playerLabels.attachLabelsToMatches(matches, labelsBySteamId) : matches;
	const matchHistoryWithScores = extras
		? require(`${__hooks}/lib/player-social.js`).attachLikeCountsToMatches(
				labeledMatches,
				likeCountsBySteamId
			)
		: labeledMatches;
	const matchHistoryWithRanks = extras
		? enrichMatchHistoryWithRankLevels(
				matchHistoryWithScores,
				relicProfile.profile_id,
				relicProfile.leaderboardStats
			)
		: matchHistoryWithScores;
	const matchHistoryWithLobbies = extras
		? matchHistory.attachReplayLobbyIds(matchHistoryWithRanks)
		: matchHistoryWithRanks;

	const page = {
		steamId,
		profileId: relicProfile.profile_id,
		alias: relicProfile.alias,
		country: relicProfile.country || null,
		level: relicProfile.level ?? 0,
		avatarUrl: steamProfile.avatarfull || steamProfile.avatarmedium || steamProfile.avatar,
		personastate: steamProfile.personastate ?? 0,
		gameextrainfo: steamProfile.gameextrainfo || null,
		lastlogoff: steamProfile.lastlogoff ?? null,
		timecreated: steamProfile.timecreated ?? null,
		playtimeForever: playtime?.playtime_forever ?? null,
		playtime2weeks: playtime?.playtime_2weeks ?? null,
		leaderboardStats: relicProfile.leaderboardStats ?? [],
		elo,
		performance,
		matchHistory: matchHistoryWithLobbies,
		smurf,
		labels: labelsBySteamId[steamId] ?? []
	};

	writePageCache(cacheKey, page);
	return withLikeCount(page);
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function handleGet(e) {
	const id = e.request.pathValue('id');
	const origin = e.request.header.get('Origin') || 'none';

	logInfo('Player page request', { id, origin });

	try {
		const data = loadPlayerPage(id, { extras: true });
		logInfo('Player page loaded', {
			id,
			steamId: data.steamId,
			profileId: data.profileId,
			alias: data.alias,
			statCount: data.leaderboardStats.length,
			matchCount: data.matchHistory.length
		});
		return jsonWithCors(e, 200, data, PAGE_CACHE_CONTROL);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = error?.status || (message.includes('STEAM_API_KEY') ? 503 : 500);

		if (status === 400) {
			logWarn('Player invalid id', { id });
			return jsonWithCors(e, 400, { message: 'id must be a SteamID64 or Relic profile id' });
		}

		if (status === 404) {
			logWarn('Player not found', { id });
			return jsonWithCors(e, 404, { message: 'Player not found' });
		}

		logError('Failed to load player page', { id, error: message });

		if (status === 503) {
			return jsonWithCors(e, 503, { message: 'Player service is not configured' });
		}

		return jsonWithCors(e, 500, { message: 'Failed to load player' });
	}
}

function handleCardGet(e) {
	const steamId = e.request.pathValue('steamId');
	const origin = e.request.header.get('Origin') || 'none';

	logInfo('Player card request', { steamId, origin });

	try {
		const data = loadPlayerPage(steamId, { extras: false });
		logInfo('Player card loaded', {
			steamId: data.steamId,
			profileId: data.profileId,
			alias: data.alias,
			statCount: data.leaderboardStats.length
		});
		return jsonWithCors(e, 200, {
			steamId: data.steamId,
			profileId: data.profileId,
			alias: data.alias,
			country: data.country,
			level: data.level,
			avatarUrl: data.avatarUrl,
			stats: selectCardStats(data.leaderboardStats)
		}, PAGE_CACHE_CONTROL);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = error?.status || (message.includes('STEAM_API_KEY') ? 503 : 500);

		if (status === 400) {
			logWarn('Player card invalid steamId', { steamId });
			return jsonWithCors(e, 400, { message: 'steamId must be a 17-digit SteamID64' });
		}

		if (status === 404) {
			logWarn('Player card not found', { steamId });
			return jsonWithCors(e, 404, { message: 'Player not found' });
		}

		logError('Failed to load player card', { steamId, error: message });

		if (status === 503) {
			return jsonWithCors(e, 503, { message: 'Player card service is not configured' });
		}

		return jsonWithCors(e, 500, { message: 'Failed to load player card' });
	}
}

module.exports = {
	handleGet,
	handleOptions,
	handleCardGet,
	loadPlayerPage,
	selectCardStats,
	fetchRelicProfileBySteamId,
	fetchRelicProfileById,
	applyCors,
	jsonWithCors
};
