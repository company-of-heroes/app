/** Test double for @tauri-apps/plugin-http */

type FetchHandler = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

let handler: FetchHandler = async () => new Response('{}', { status: 200 });

export const __http = {
	setHandler(next: FetchHandler) {
		handler = next;
	},
	reset() {
		handler = async () => new Response('{}', { status: 200 });
	}
};

export function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
	return handler(input, init);
}
