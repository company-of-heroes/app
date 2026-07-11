import { log, logError } from './logger';
import {
	assertSteamAvailable,
	RateLimitError,
	recordSteamCall,
	setSteamBlocked,
	waitForSteamSlot
} from './steam-rate';

export { RateLimitError } from './steam-rate';

export type SmurfWatchRecord = {
	id: string;
	steam_id: string;
	profile_id?: number;
	status: string;
	source: string;
	priority: number;
	check_interval_sec: number;
	owns_coh?: boolean | null;
};

export type SmurfWatchBatch = {
	screening: SmurfWatchRecord[];
	polling: SmurfWatchRecord[];
	fetched_at: string;
};

export type Env = {
	STEAM_API_KEY: string;
	PB_URL: string;
	SMURF_SERVICE_TOKEN: string;
	STEAM_RATE_LIMIT?: KVNamespace;
};

export const WORKER_SCREENING_LIMIT = 10;
export const WORKER_POLLING_LIMIT = 30;
const STEAM_SUMMARY_CHUNK = 100;

const COH_APP_ID = 228200;

export async function pbRequest<T>(
	env: Env,
	path: string,
	init: RequestInit = {}
): Promise<T> {
	const method = init.method ?? 'GET';
	const startedAt = Date.now();

	log('debug', 'pocketbase request', { method, path });

	const response = await fetch(`${env.PB_URL.replace(/\/$/, '')}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${env.SMURF_SERVICE_TOKEN}`,
			'Content-Type': 'application/json',
			...(init.headers ?? {})
		}
	});

	const durationMs = Date.now() - startedAt;

	if (!response.ok) {
		const text = await response.text();
		log('error', 'pocketbase request failed', {
			method,
			path,
			status: response.status,
			durationMs,
			body: text.slice(0, 500)
		});
		throw new Error(`PocketBase ${path} failed: ${response.status} ${text}`);
	}

	log('debug', 'pocketbase request ok', { method, path, status: response.status, durationMs });

	return response.json() as Promise<T>;
}

export async function fetchWorkerBatch(env: Env): Promise<SmurfWatchBatch> {
	const batch = await pbRequest<SmurfWatchBatch>(
		env,
		`/api/smurf-watch/worker/batch?screeningLimit=${WORKER_SCREENING_LIMIT}&pollingLimit=${WORKER_POLLING_LIMIT}`
	);

	log('info', 'worker batch fetched', {
		screeningCount: batch.screening.length,
		pollingCount: batch.polling.length,
		fetchedAt: batch.fetched_at
	});

	return batch;
}

export async function patchSmurfWatch(
	env: Env,
	id: string,
	body: Record<string, unknown>
): Promise<void> {
	log('debug', 'patching smurf watch', { id, fields: Object.keys(body), status: body.status });

	await pbRequest(env, `/api/smurf-watch/worker/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body)
	});
}

async function steamRequest<T>(
	env: Env,
	endpoint: string,
	params: Record<string, string | number>
): Promise<T> {
	const steamIds = params.steamid ?? params.steamids;

	await waitForSteamSlot(env, endpoint);

	const startedAt = Date.now();
	log('debug', 'steam request', { endpoint, steamIds });

	const url = new URL(`https://api.steampowered.com${endpoint}`);
	url.searchParams.set('key', env.STEAM_API_KEY);

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	const response = await fetch(url.toString());
	const durationMs = Date.now() - startedAt;

	await recordSteamCall(env);

	if (response.status === 429) {
		const retryAfter = Number(response.headers.get('Retry-After') || 60);
		log('warn', 'steam rate limited', { endpoint, retryAfterSec: retryAfter, durationMs });
		await setSteamBlocked(env, retryAfter);
		throw new RateLimitError(retryAfter);
	}

	if (!response.ok) {
		log('error', 'steam request failed', {
			endpoint,
			status: response.status,
			durationMs,
			steamIds
		});
		throw new Error(`Steam ${endpoint} failed: ${response.status}`);
	}

	log('debug', 'steam request ok', { endpoint, status: response.status, durationMs, steamIds });

	return response.json() as Promise<T>;
}

export async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getOwnedCoH(
	env: Env,
	steamId: string
): Promise<boolean | null> {
	const data = await steamRequest<{
		response?: { game_count?: number; games?: { appid: number }[] };
	}>(env, '/IPlayerService/GetOwnedGames/v1/', {
		steamid: steamId,
		include_appinfo: 0,
		include_played_free_games: 1,
		'appids_filter[0]': COH_APP_ID
	});

	const games = data.response?.games ?? [];
	if (games.length > 0) {
		const owns = games.some((game) => game.appid === COH_APP_ID);
		log('debug', 'owned games check', { steamId, ownsCoH: owns });
		return owns;
	}

	if ((data.response?.game_count ?? 0) === 0) {
		log('debug', 'owned games check', { steamId, ownsCoH: false, gameCount: 0 });
		return false;
	}

	log('debug', 'owned games check inconclusive', {
		steamId,
		gameCount: data.response?.game_count
	});
	return null;
}

export async function getPlayerSummaries(
	env: Env,
	steamIds: string[]
): Promise<Map<string, { gameid?: string; personastate: number }>> {
	if (steamIds.length === 0) {
		return new Map();
	}

	const map = new Map<string, { gameid?: string; personastate: number }>();

	for (let index = 0; index < steamIds.length; index += STEAM_SUMMARY_CHUNK) {
		const chunk = steamIds.slice(index, index + STEAM_SUMMARY_CHUNK);
		const data = await steamRequest<{
			response?: { players?: { steamid: string; gameid?: string; personastate: number }[] };
		}>(env, '/ISteamUser/GetPlayerSummaries/v2/', {
			steamids: chunk.join(',')
		});

		for (const player of data.response?.players ?? []) {
			map.set(player.steamid, {
				gameid: player.gameid,
				personastate: player.personastate
			});
		}
	}

	const playingCoH = [...map.values()].filter((p) => p.gameid === String(COH_APP_ID)).length;
	log('debug', 'player summaries fetched', {
		requested: steamIds.length,
		returned: map.size,
		playingCoH,
		chunks: Math.ceil(steamIds.length / STEAM_SUMMARY_CHUNK)
	});

	return map;
}

export async function getLenderSteamId(env: Env, steamId: string): Promise<string | null> {
	const data = await steamRequest<{
		response?: { lender_steamid?: string };
	}>(env, '/IPlayerService/IsPlayingSharedGame/v1/', {
		steamid: steamId,
		appid_playing: COH_APP_ID
	});

	const lender = data.response?.lender_steamid;
	if (!lender || lender === '0') {
		log('debug', 'shared game check', { steamId, lenderFound: false });
		return null;
	}

	log('debug', 'shared game check', { steamId, lenderFound: true, lenderSteamId: lender });
	return lender;
}

export async function getCohStatsLender(steamId: string): Promise<string | null> {
	const startedAt = Date.now();

	try {
		log('debug', 'cohstats lookup', { steamId });

		const response = await fetch(`https://playercard.cohstats.com/?steamid=${steamId}`);
		const durationMs = Date.now() - startedAt;

		if (!response.ok) {
			log('debug', 'cohstats lookup failed', {
				steamId,
				status: response.status,
				durationMs
			});
			return null;
		}

		const html = await response.text();
		const match = html.match(/id="infoSmurfText"[\s\S]*?steamid=(\d{17})/i);
		const lender = match?.[1] ?? null;

		log('debug', 'cohstats lookup ok', {
			steamId,
			lenderFound: lender !== null,
			lenderSteamId: lender,
			durationMs
		});

		return lender;
	} catch (error) {
		logError('cohstats lookup error', error, {
			steamId,
			durationMs: Date.now() - startedAt
		});
		return null;
	}
}

export function nextBackoffSeconds(current: number): number {
	const steps = [300, 900, 3600, 21600];
	const index = steps.findIndex((step) => step > current);
	return index === -1 ? 21600 : steps[index];
}

export function isoNow(): string {
	return new Date().toISOString();
}

export function isoAfterSeconds(seconds: number): string {
	return new Date(Date.now() + seconds * 1000).toISOString();
}

export { assertSteamAvailable, COH_APP_ID };
