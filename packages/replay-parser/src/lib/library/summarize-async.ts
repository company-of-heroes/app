import SummaryWorker from './summary.worker?worker';
import { summarizeReplay } from './summary';
import type { ReplaySummary } from './types';

type Response = { id: number; summary?: ReplaySummary; error?: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
	number,
	{ resolve: (summary: ReplaySummary) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
	if (worker) {
		return worker;
	}

	worker = new SummaryWorker();
	worker.onmessage = (event: MessageEvent<Response>) => {
		const entry = pending.get(event.data.id);
		if (!entry) {
			return;
		}

		pending.delete(event.data.id);
		if (event.data.summary) {
			entry.resolve(event.data.summary);
		} else {
			entry.reject(new Error(event.data.error ?? 'Failed to parse replay.'));
		}
	};
	worker.onerror = () => {
		for (const [, entry] of pending) {
			entry.reject(new Error('Replay worker failed.'));
		}

		pending.clear();
		worker?.terminate();
		worker = null;
	};

	return worker;
}

/** Parses off the main thread; falls back to the main thread if the worker cannot start. */
export function summarizeReplayAsync(bytes: Uint8Array): Promise<ReplaySummary> {
	const id = nextId++;
	const buffer = bytes.slice().buffer;
	return new Promise<ReplaySummary>((resolve, reject) => {
		pending.set(id, { resolve, reject });
		try {
			getWorker().postMessage({ id, bytes: buffer }, [buffer]);
		} catch {
			pending.delete(id);
			try {
				resolve(summarizeReplay(bytes));
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		}
	});
}
