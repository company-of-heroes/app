// Requires STEAM_API_KEY in the PocketBase runtime environment.
'use strict';

const RELIC_API_BASE = 'https://coh1-lobby.reliclink.com';
const STEAM_ID_REGEX = /^7656119\d{10}$/;
const RANKED_LEADERBOARD_MIN = 4;
const RANKED_LEADERBOARD_MAX = 19;
const MAX_CARD_STATS = 4;

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174'
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
	19: '4v4'
};

const LEADERBOARD_FACTION_LABELS = {
	4: 'US',
	8: 'US',
	12: 'US',
	16: 'US',
	5: 'Wehrmacht',
	9: 'Wehrmacht',
	13: 'Wehrmacht',
	17: 'Wehrmacht',
	6: 'Brits',
	10: 'Brits',
	14: 'Brits',
	18: 'Brits',
	7: 'Panzer Elite',
	11: 'Panzer Elite',
	15: 'Panzer Elite',
	19: 'Panzer Elite'
};

function isRankedLeaderboard(leaderboardId) {
	return leaderboardId >= RANKED_LEADERBOARD_MIN && leaderboardId <= RANKED_LEADERBOARD_MAX;
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

function jsonWithCors(e, status, body) {
	applyCors(e);
	return e.json(status, body);
}

function parseHttpJson(response) {
	if (!response) {
		throw new Error('Empty HTTP response');
	}

	if (response.statusCode < 200 || response.statusCode >= 300) {
		throw new Error(`Upstream HTTP ${response.statusCode}`);
	}

	if (response.json != null) {
		return response.json;
	}

	const raw = response.raw || '';
	if (!raw) {
		throw new Error('Empty HTTP body');
	}

	return JSON.parse(raw);
}

function fetchRelicProfileBySteamId(steamId) {
	const url =
		`${RELIC_API_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_names=` +
		encodeURIComponent(JSON.stringify([`/steam/${steamId}`]));

	const response = $http.send({
		url,
		method: 'GET',
		timeout: 15
	});

	const data = parseHttpJson(response);
	const members = data?.statGroups?.[0]?.members ?? [];
	const member = members.find((entry) => entry?.name === `/steam/${steamId}`);

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
		personal_statgroup_id: member.personal_statgroup_id,
		leaderboardStats
	};
}

function fetchSteamProfile(steamId) {
	const apiKey = $os.getenv('STEAM_API_KEY');
	if (!apiKey) {
		throw new Error('STEAM_API_KEY is not configured');
	}

	const url =
		'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?' +
		`key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`;

	const response = $http.send({
		url,
		method: 'GET',
		timeout: 15
	});

	const data = parseHttpJson(response);
	return data?.response?.players?.[0] ?? null;
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

	return sorted.slice(0, MAX_CARD_STATS).map((stat) => ({
		leaderboardId: stat.leaderboard_id,
		modeLabel: LEADERBOARD_MODE_LABELS[stat.leaderboard_id] || 'Unknown',
		factionLabel: LEADERBOARD_FACTION_LABELS[stat.leaderboard_id] || 'Unknown',
		ranklevel: stat.ranklevel ?? 0,
		rank: stat.rank ?? 0,
		wins: stat.wins ?? 0,
		losses: stat.losses ?? 0,
		streak: stat.streak ?? 0
	}));
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function handleGet(e) {
	const steamId = e.request.pathValue('steamId');

	if (!steamId || !STEAM_ID_REGEX.test(steamId)) {
		return jsonWithCors(e, 400, { message: 'steamId must be a 17-digit SteamID64' });
	}

	try {
		const relicProfile = fetchRelicProfileBySteamId(steamId);
		if (!relicProfile) {
			return jsonWithCors(e, 404, { message: 'Player not found' });
		}

		const steamProfile = fetchSteamProfile(steamId);
		if (!steamProfile) {
			return jsonWithCors(e, 404, { message: 'Player not found' });
		}

		return jsonWithCors(e, 200, {
			steamId,
			profileId: relicProfile.profile_id,
			alias: relicProfile.alias,
			country: relicProfile.country || null,
			level: relicProfile.level ?? 0,
			avatarUrl: steamProfile.avatarfull || steamProfile.avatarmedium || steamProfile.avatar,
			stats: selectCardStats(relicProfile.leaderboardStats)
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('[player-card] failed:', message);

		if (message.includes('STEAM_API_KEY')) {
			return jsonWithCors(e, 503, { message: 'Player card service is not configured' });
		}

		return jsonWithCors(e, 500, { message: 'Failed to load player card' });
	}
}

module.exports = {
	handleGet,
	handleOptions
};
