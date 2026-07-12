import { log, logError } from './logger';
import {
	COH_APP_ID,
	type PlayerPresence,
	isPlayingCoH,
	parseCohStatsLenderFromHtml
} from './detect';
import {
	assertSteamAvailable,
	RateLimitError,
	recordSteamCall,
	setSteamBlocked,
	waitForSteamSlot
} from './steam-rate';

export { RateLimitError } from './steam-rate';
export { COH_APP_ID, isPlayingCoH, parseCohStatsLenderFromHtml, type PlayerPresence } from './detect';

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
	total_pending?: number;
	total_watching_due?: number;
};

export type Env = {
	STEAM_API_KEY: string;
	PB_URL: string;
	SMURF_SERVICE_TOKEN: string;
	STEAM_RATE_LIMIT?: KVNamespace;
};

export const COHSTATS_SCREENING_LIMIT = 30;
export const WORKER_POLLING_LIMIT = 30;
export const MAX_STEAM_CALLS_PER_RUN = 8;
const STEAM_SUMMARY_CHUNK = 100;

export class SteamCallBudget {
	private used = 0;
	private readonly maxCalls: number;

	constructor(maxCalls: number) {
		this.maxCalls = maxCalls;
	}

	canSpend(): boolean {
		return this.used < this.maxCalls;
	}

	spend(): void {
		this.used++;
	}

	get remaining(): number {
		return Math.max(0, this.maxCalls - this.used);
	}

	get spent(): number {
		return this.used;
	}
}

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
		`/api/smurf-watch/worker/batch?screeningLimit=${COHSTATS_SCREENING_LIMIT}&pollingLimit=${WORKER_POLLING_LIMIT}`
	);

	log('info', 'worker batch fetched', {
		screeningCount: batch.screening.length,
		pollingCount: batch.polling.length,
		totalPending: batch.total_pending,
		totalWatchingDue: batch.total_watching_due,
		fetchedAt: batch.fetched_at
	});

	return batch;
}

export async function patchSmurfWatch(
	env: Env,
	id: string,
	body: Record<string, unknown>,
	meta?: Record<string, unknown>
): Promise<void> {
	const startedAt = Date.now();

	log('debug', 'patching smurf watch', {
		id,
		fields: Object.keys(body),
		status: body.status,
		outcome: meta?.outcome,
		phase: meta?.phase
	});

	try {
		await pbRequest(env, `/api/smurf-watch/worker/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(body)
		});

		log('info', 'patch smurf watch ok', {
			id,
			status: body.status,
			outcome: meta?.outcome,
			phase: meta?.phase,
			durationMs: Date.now() - startedAt
		});
	} catch (error) {
		logError('patch smurf watch failed', error, {
			id,
			fields: Object.keys(body),
			outcome: meta?.outcome,
			phase: meta?.phase,
			durationMs: Date.now() - startedAt
		});
		throw error;
	}
}

async function steamRequest<T>(
	env: Env,
	endpoint: string,
	params: Record<string, string | number>,
	budget?: SteamCallBudget
): Promise<T> {
	if (budget) {
		if (!budget.canSpend()) {
			log('warn', 'steam call budget exhausted', {
				endpoint,
				spent: budget.spent,
				remaining: budget.remaining
			});
			throw new RateLimitError(300);
		}
		budget.spend();
	}

	const steamIds = params.steamid ?? params.steamids;

	await waitForSteamSlot(env, endpoint);

	const startedAt = Date.now();
	log('debug', 'steam request', {
		endpoint,
		steamIds,
		budgetRemaining: budget?.remaining
	});

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

export async function getOwnedCoH(
	env: Env,
	steamId: string,
	budget?: SteamCallBudget
): Promise<boolean | null> {
	const data = await steamRequest<{
		response?: { game_count?: number; games?: { appid: number }[] };
	}>(
		env,
		'/IPlayerService/GetOwnedGames/v1/',
		{
			steamid: steamId,
			include_appinfo: 0,
			include_played_free_games: 1,
			'appids_filter[0]': COH_APP_ID
		},
		budget
	);

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
	steamIds: string[],
	budget?: SteamCallBudget
): Promise<Map<string, PlayerPresence>> {
	if (steamIds.length === 0) {
		return new Map();
	}

	const map = new Map<string, PlayerPresence>();

	for (let index = 0; index < steamIds.length; index += STEAM_SUMMARY_CHUNK) {
		const chunk = steamIds.slice(index, index + STEAM_SUMMARY_CHUNK);
		const data = await steamRequest<{
			response?: {
				players?: {
					steamid: string;
					gameid?: string;
					gameextrainfo?: string;
					personastate: number;
				}[];
			};
		}>(
			env,
			'/ISteamUser/GetPlayerSummaries/v2/',
			{
				steamids: chunk.join(',')
			},
			budget
		);

		for (const player of data.response?.players ?? []) {
			map.set(player.steamid, {
				gameid: player.gameid,
				gameextrainfo: player.gameextrainfo,
				personastate: player.personastate
			});
		}
	}

	const playingCoH = [...map.entries()].filter(([, presence]) => isPlayingCoH(presence)).length;
	log('debug', 'player summaries fetched', {
		requested: steamIds.length,
		returned: map.size,
		playingCoH,
		chunks: Math.ceil(steamIds.length / STEAM_SUMMARY_CHUNK)
	});

	return map;
}

export async function getLenderSteamId(
	env: Env,
	steamId: string,
	budget?: SteamCallBudget
): Promise<string | null> {
	const data = await steamRequest<{
		response?: { lender_steamid?: string };
	}>(
		env,
		'/IPlayerService/IsPlayingSharedGame/v1/',
		{
			steamid: steamId,
			appid_playing: COH_APP_ID
		},
		budget
	);

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
		const smurfCellPresent = /<td[^>]*id="infoSmurfText"/i.test(html);
		const lender = parseCohStatsLenderFromHtml(html);

		log('debug', 'cohstats lookup ok', {
			steamId,
			smurfCellPresent,
			linkFound: lender !== null,
			lenderSteamId: lender,
			durationMs,
			htmlSnippet: html.slice(0, 300)
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

export { assertSteamAvailable };
