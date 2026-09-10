/// <reference lib="webworker" />

import { flattenReplay, toSlimReplay, type FlatReplay } from '$lib/replays/flatten-replay';

type ParseRequest = {
	id: number;
	type?: 'parse' | 'actions';
	content?: ArrayBuffer;
};

const cache = new Map<number, FlatReplay>();

onmessage = async ({ data }: MessageEvent<ParseRequest>) => {
	try {
		if (data.type === 'actions') {
			const cached = cache.get(data.id);
			if (!cached) {
				postMessage({
					id: data.id,
					success: false,
					error: 'Replay parse cache expired. Re-parse the file.'
				});
				return;
			}

			const actions = (cached.actions ?? []).map((action) => ({
				tick: action.tick,
				timestamp: action.timestamp,
				playerID: action.playerID,
				commandID: action.commandID,
				objectID: action.objectID,
				command: action.command
					? {
							type: action.command.type,
							name: action.command.name,
							description: action.command.description
						}
					: null
			}));
			postMessage({ id: data.id, success: true, actions });
			return;
		}

		if (!data.content) {
			postMessage({ id: data.id, success: false, error: 'Missing replay bytes.' });
			return;
		}

		const { parseReplay } = await import('@fknoobs/replay-parser');
		const flat = flattenReplay(parseReplay(new Uint8Array(data.content)));
		cache.set(data.id, flat);
		postMessage({ id: data.id, success: true, replay: toSlimReplay(flat) });
	} catch (error) {
		postMessage({
			id: data.id,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		});
	}
};

export {};
