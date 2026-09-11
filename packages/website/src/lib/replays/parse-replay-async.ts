import ParseReplayWorker from '$lib/workers/parse-replay.worker?worker';

type ParseSuccess = {
	id: number;
	success: true;
	replay?: unknown;
	actions?: unknown[];
};

type ParseFailure = {
	id: number;
	success: false;
	error: string;
};

type ParseResponse = ParseSuccess | ParseFailure;

export type ParseReplayResult = {
	parseId: number | null;
	replay: unknown;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
	number,
	{ resolve: (value: ParseResponse) => void; reject: (error: Error) => void }
>();

function rejectAll(message: string) {
	for (const [, entry] of pending) {
		entry.reject(new Error(message));
	}
	pending.clear();
}

function destroyWorker(message = 'Replay worker failed.') {
	if (worker) {
		worker.terminate();
		worker = null;
	}
	rejectAll(message);
}

function getWorker() {
	if (worker) {
		return worker;
	}

	worker = new ParseReplayWorker();
	worker.onmessage = (event: MessageEvent<ParseResponse>) => {
		const entry = pending.get(event.data.id);
		if (!entry) {
			return;
		}

		pending.delete(event.data.id);
		entry.resolve(event.data);
	};
	worker.onerror = (event) => {
		destroyWorker(event.message || 'Failed to parse replay.');
	};
	worker.onmessageerror = () => {
		destroyWorker('Failed to parse replay.');
	};

	return worker;
}

function callWorker(id: number, message: object, transfer?: Transferable[]): Promise<ParseResponse> {
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		try {
			getWorker().postMessage({ id, ...message }, transfer);
		} catch (error) {
			pending.delete(id);
			destroyWorker(error instanceof Error ? error.message : 'Failed to parse replay.');
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}

function toSlimFromFull(replay: {
	duration?: number;
	gameDate?: string;
	highResources?: boolean;
	randomStart?: boolean;
	mapFileName?: string;
	mapName?: string;
	matchType?: string;
	vpGame?: boolean;
	vpCount?: number;
	players?: Array<{ id?: number | null }>;
	messages?: unknown[];
	replayName?: string;
	playerCount?: number;
	actions?: unknown[];
	cpmByPlayerId?: Record<string, string>;
}) {
	return {
		duration: replay.duration ?? 0,
		gameDate: replay.gameDate,
		highResources: replay.highResources,
		randomStart: replay.randomStart,
		mapFileName: replay.mapFileName,
		mapName: replay.mapName,
		matchType: replay.matchType,
		vpGame: replay.vpGame,
		vpCount: replay.vpCount,
		players: replay.players ?? [],
		messages: replay.messages ?? [],
		replayName: replay.replayName,
		playerCount: replay.playerCount,
		actions: [],
		cpmByPlayerId: replay.cpmByPlayerId ?? {}
	};
}

/** Main-thread fallback when the worker cannot start (keeps detail pages usable). */
async function parseReplayOnMainThread(bytes: ArrayBuffer | Uint8Array): Promise<ParseReplayResult> {
	const { parseReplay } = await import('@fknoobs/replay-parser');
	const { flattenReplay, toSlimReplay } = await import('$lib/replays/flatten-replay');
	// Let the loading skeleton paint before the sync parse blocks.
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	const flat = flattenReplay(parseReplay(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)));

	return {
		parseId: null,
		replay: toSlimFromFull(toSlimReplay(flat))
	};
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(message));
		}, ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

/**
 * Parse a .rec off the main thread when possible.
 * Returns a slim replay (no action list) so postMessage does not freeze the UI.
 */
export async function parseReplayAsync(bytes: ArrayBuffer | Uint8Array): Promise<ParseReplayResult> {
	const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	const copy = source.slice().buffer;
	const parseId = nextId++;

	try {
		const response = await withTimeout(
			callWorker(parseId, { type: 'parse', content: copy }, [copy]),
			45_000,
			'Replay parse timed out.'
		);
		if (!response.success) {
			throw new Error(response.error || 'Failed to parse replay.');
		}

		return { parseId, replay: response.replay };
	} catch (error) {
		console.warn('[parse-replay] worker failed, falling back to main thread', error);
		destroyWorker();
		return parseReplayOnMainThread(source);
	}
}

/** Lazily pull timeline actions for a prior worker {@link parseReplayAsync} result. */
export async function loadReplayActionsAsync(parseId: number): Promise<unknown[]> {
	const response = await callWorker(parseId, { type: 'actions' });
	if (!response.success) {
		throw new Error(response.error || 'Failed to load replay actions.');
	}

	return response.actions ?? [];
}
