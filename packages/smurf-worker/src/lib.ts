export type SmurfWatchRecord = {
	id: string;
	steam_id: string;
	profile_id?: number;
	status: string;
	source: string;
	priority: number;
	check_interval_sec: number;
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
};

const COH_APP_ID = 228200;

export async function pbRequest<T>(
	env: Env,
	path: string,
	init: RequestInit = {}
): Promise<T> {
	const response = await fetch(`${env.PB_URL.replace(/\/$/, '')}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${env.SMURF_SERVICE_TOKEN}`,
			'Content-Type': 'application/json',
			...(init.headers ?? {})
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`PocketBase ${path} failed: ${response.status} ${text}`);
	}

	return response.json() as Promise<T>;
}

export async function fetchWorkerBatch(env: Env): Promise<SmurfWatchBatch> {
	return pbRequest<SmurfWatchBatch>(env, '/api/smurf-watch/worker/batch?screeningLimit=50&pollingLimit=150');
}

export async function patchSmurfWatch(
	env: Env,
	id: string,
	body: Record<string, unknown>
): Promise<void> {
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
	const url = new URL(`https://api.steampowered.com${endpoint}`);
	url.searchParams.set('key', env.STEAM_API_KEY);

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	const response = await fetch(url.toString());
	if (response.status === 429) {
		const retryAfter = Number(response.headers.get('Retry-After') || 60);
		throw new RateLimitError(retryAfter);
	}

	if (!response.ok) {
		throw new Error(`Steam ${endpoint} failed: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export class RateLimitError extends Error {
	constructor(public retryAfterSec: number) {
		super(`Rate limited, retry after ${retryAfterSec}s`);
	}
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
		return games.some((game) => game.appid === COH_APP_ID);
	}

	if ((data.response?.game_count ?? 0) === 0) {
		return false;
	}

	return null;
}

export async function getPlayerSummaries(
	env: Env,
	steamIds: string[]
): Promise<Map<string, { gameid?: string; personastate: number }>> {
	if (steamIds.length === 0) {
		return new Map();
	}

	const data = await steamRequest<{
		response?: { players?: { steamid: string; gameid?: string; personastate: number }[] };
	}>(env, '/ISteamUser/GetPlayerSummaries/v2/', {
		steamids: steamIds.join(',')
	});

	const map = new Map<string, { gameid?: string; personastate: number }>();
	for (const player of data.response?.players ?? []) {
		map.set(player.steamid, {
			gameid: player.gameid,
			personastate: player.personastate
		});
	}

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
		return null;
	}

	return lender;
}

export async function getCohStatsLender(steamId: string): Promise<string | null> {
	try {
		const response = await fetch(`https://playercard.cohstats.com/?steamid=${steamId}`);
		if (!response.ok) {
			return null;
		}

		const html = await response.text();
		const match = html.match(/id="infoSmurfText"[\s\S]*?steamid=(\d{17})/i);
		return match?.[1] ?? null;
	} catch {
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

export { COH_APP_ID };
