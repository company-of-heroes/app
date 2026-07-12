import type { Env } from './lib';
import { clearRunContext, createRunContext, log, logError } from './logger';
import { runSmurfWorker } from './worker';

function runWorkerWithLogging(env: Env, trigger: 'scheduled' | 'manual'): Promise<void> {
	const startedAt = Date.now();
	const runId = createRunContext();

	log('info', 'smurf worker started', { trigger, runId });

	return runSmurfWorker(env)
		.then(() => {
			log('info', 'smurf worker finished', {
				trigger,
				runId,
				durationMs: Date.now() - startedAt
			});
		})
		.catch((error: unknown) => {
			logError('smurf worker failed', error, {
				trigger,
				runId,
				durationMs: Date.now() - startedAt
			});
		})
		.finally(() => {
			clearRunContext();
		});
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		log('info', 'scheduled trigger received', {
			cron: event.cron,
			scheduledTime: new Date(event.scheduledTime).toISOString()
		});

		ctx.waitUntil(runWorkerWithLogging(env, 'scheduled'));
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		const requestMeta = {
			method: request.method,
			path: url.pathname,
			cfRay: request.headers.get('cf-ray') ?? undefined
		};

		log('debug', 'fetch request', requestMeta);

		if (url.pathname === '/health') {
			log('debug', 'health check ok', requestMeta);
			return new Response('ok');
		}

		if (url.pathname === '/run' && request.method === 'POST') {
			const auth = request.headers.get('Authorization');
			const expected = `Bearer ${env.SMURF_SERVICE_TOKEN}`;

			if (auth !== expected) {
				log('warn', 'manual run unauthorized', {
					...requestMeta,
					hasAuthHeader: auth !== null,
					authScheme: auth?.split(' ')[0] ?? null
				});
				return new Response('Unauthorized', { status: 401 });
			}

			log('info', 'manual run accepted', requestMeta);

			ctx.waitUntil(runWorkerWithLogging(env, 'manual'));

			return new Response('started');
		}

		log('warn', 'fetch not found', requestMeta);
		return new Response('Not found', { status: 404 });
	}
};
