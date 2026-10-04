import { summarizeReplay } from './summary';

type Request = { id: number; bytes: ArrayBuffer };

self.onmessage = (event: MessageEvent<Request>) => {
	const { id, bytes } = event.data;
	try {
		self.postMessage({ id, summary: summarizeReplay(new Uint8Array(bytes)) });
	} catch (error) {
		self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
	}
};
