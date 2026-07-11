import { log } from './logger';

export class RateLimitError extends Error {
	constructor(public retryAfterSec: number) {
		super(`Rate limited, retry after ${retryAfterSec}s`);
	}
}

const KV_BLOCKED_KEY = 'steam_blocked_until';
const KV_LAST_CALL_KEY = 'steam_last_call_at';
const KV_WORKER_LOCK_KEY = 'worker_lock';

const WORKER_LOCK_TTL_SEC = 600;
const WORKER_LOCK_MAX_AGE_MS = 4 * 60 * 1000;

let memoryBlockedUntil = 0;
let memoryLastCallAt = 0;

export function minIntervalForEndpoint(endpoint: string): number {
	if (endpoint.includes('GetOwnedGames')) {
		return 3500;
	}
	if (endpoint.includes('IsPlayingSharedGame')) {
		return 2500;
	}
	return 2000;
}

async function readBlockedUntil(env: { STEAM_RATE_LIMIT?: KVNamespace }): Promise<number> {
	const kvValue = await env.STEAM_RATE_LIMIT?.get(KV_BLOCKED_KEY);
	const kvBlocked = kvValue ? Number(kvValue) : 0;
	return Math.max(memoryBlockedUntil, kvBlocked);
}

async function readLastCallAt(env: { STEAM_RATE_LIMIT?: KVNamespace }): Promise<number> {
	const kvValue = await env.STEAM_RATE_LIMIT?.get(KV_LAST_CALL_KEY);
	const kvLastCall = kvValue ? Number(kvValue) : 0;
	return Math.max(memoryLastCallAt, kvLastCall);
}

export async function getSteamBlockedSeconds(
	env: { STEAM_RATE_LIMIT?: KVNamespace }
): Promise<number> {
	const blockedUntil = await readBlockedUntil(env);
	const remainingMs = blockedUntil - Date.now();
	return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export async function assertSteamAvailable(env: { STEAM_RATE_LIMIT?: KVNamespace }): Promise<void> {
	const remainingSec = await getSteamBlockedSeconds(env);
	if (remainingSec > 0) {
		log('warn', 'steam globally blocked, skipping calls', { retryAfterSec: remainingSec });
		throw new RateLimitError(remainingSec);
	}
}

export async function setSteamBlocked(
	env: { STEAM_RATE_LIMIT?: KVNamespace },
	retryAfterSec: number
): Promise<void> {
	const blockedUntil = Date.now() + retryAfterSec * 1000;
	memoryBlockedUntil = blockedUntil;

	await env.STEAM_RATE_LIMIT?.put(KV_BLOCKED_KEY, String(blockedUntil), {
		expirationTtl: retryAfterSec + 60
	});

	log('warn', 'steam blocked until', {
		retryAfterSec,
		blockedUntil: new Date(blockedUntil).toISOString()
	});
}

export async function waitForSteamSlot(
	env: { STEAM_RATE_LIMIT?: KVNamespace },
	endpoint: string
): Promise<void> {
	await assertSteamAvailable(env);

	const minInterval = minIntervalForEndpoint(endpoint);
	const lastCallAt = await readLastCallAt(env);
	const waitMs = lastCallAt + minInterval - Date.now();

	if (waitMs > 0) {
		log('debug', 'steam throttle wait', { endpoint, waitMs });
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}
}

export async function recordSteamCall(env: { STEAM_RATE_LIMIT?: KVNamespace }): Promise<void> {
	const now = Date.now();
	memoryLastCallAt = now;
	await env.STEAM_RATE_LIMIT?.put(KV_LAST_CALL_KEY, String(now), { expirationTtl: 3600 });
}

export async function tryAcquireWorkerLock(env: {
	STEAM_RATE_LIMIT?: KVNamespace;
}): Promise<boolean> {
	const kv = env.STEAM_RATE_LIMIT;
	if (!kv) {
		return true;
	}

	const lock = await kv.get(KV_WORKER_LOCK_KEY);
	if (lock) {
		const lockedAt = Number(lock);
		if (Date.now() - lockedAt < WORKER_LOCK_MAX_AGE_MS) {
			log('info', 'worker skipped: previous run still active', {
				lockedAt: new Date(lockedAt).toISOString()
			});
			return false;
		}
	}

	await kv.put(KV_WORKER_LOCK_KEY, String(Date.now()), { expirationTtl: WORKER_LOCK_TTL_SEC });
	return true;
}

export async function releaseWorkerLock(env: { STEAM_RATE_LIMIT?: KVNamespace }): Promise<void> {
	await env.STEAM_RATE_LIMIT?.delete(KV_WORKER_LOCK_KEY);
}
