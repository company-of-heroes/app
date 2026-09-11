const FILE_BURST_MAX = 8;
const FILE_BURST_MS = 10_000;
const FILE_WINDOW_MAX = 40;
const FILE_WINDOW_MS = 60_000;

type Bucket = { times: number[] };

const buckets = new Map<string, Bucket>();

function prune(key: string, windowMs: number, now: number): number[] {
	const bucket = buckets.get(key);
	if (!bucket) {
		return [];
	}

	bucket.times = bucket.times.filter((time) => now - time < windowMs);
	if (!bucket.times.length) {
		buckets.delete(key);
		return [];
	}

	return bucket.times;
}

function retryAfterSec(times: number[], windowMs: number, now: number): number {
	if (!times.length) {
		return 1;
	}

	return Math.max(1, Math.ceil((windowMs - (now - times[0])) / 1000));
}

export function allowReplayFileRequest(
	ip: string
): { ok: true } | { ok: false; retryAfter: number } {
	const now = Date.now();
	const burstKey = `file:${ip}:burst`;
	const windowKey = `file:${ip}`;
	const burstTimes = prune(burstKey, FILE_BURST_MS, now);
	if (burstTimes.length >= FILE_BURST_MAX) {
		return { ok: false, retryAfter: retryAfterSec(burstTimes, FILE_BURST_MS, now) };
	}

	const windowTimes = prune(windowKey, FILE_WINDOW_MS, now);
	if (windowTimes.length >= FILE_WINDOW_MAX) {
		return { ok: false, retryAfter: retryAfterSec(windowTimes, FILE_WINDOW_MS, now) };
	}

	const burst = buckets.get(burstKey) ?? { times: [] };
	burst.times.push(now);
	buckets.set(burstKey, burst);
	const window = buckets.get(windowKey) ?? { times: [] };
	window.times.push(now);
	buckets.set(windowKey, window);
	return { ok: true };
}
