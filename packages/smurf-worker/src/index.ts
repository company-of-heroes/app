import type { Env } from './lib';
import { runSmurfWorker } from './worker';

export default {
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(runSmurfWorker(env));
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === '/health') {
			return new Response('ok');
		}

		if (url.pathname === '/run' && request.method === 'POST') {
			const auth = request.headers.get('Authorization');
			if (auth !== `Bearer ${env.SMURF_SERVICE_TOKEN}`) {
				return new Response('Unauthorized', { status: 401 });
			}

			ctx.waitUntil(runSmurfWorker(env));
			return new Response('started');
		}

		return new Response('Not found', { status: 404 });
	}
};
