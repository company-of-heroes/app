type Env = { WEBSITE: Fetcher; SERVICE_TOKEN: string };

/** Runs when minute % every === offset (offsets spread the Relic load). */
const JOBS: { name: string; every: number; offset: number }[] = [
	{ name: 'live-cleanup', every: 1, offset: 0 },
	{ name: 'result-fill', every: 1, offset: 0 },
	{ name: 'ladder-harvest', every: 5, offset: 2 },
	{ name: 'ratings-harvest', every: 5, offset: 3 },
	{ name: 'user-merge', every: 5, offset: 4 },
	{ name: 'rewards-evaluate', every: 1, offset: 0 }
];

/** A job reports `more` while work is left; keep one tick well inside the time limit. */
const MAX_RUNS_PER_TICK = 5;

async function run(env: Env, name: string): Promise<void> {
	for (let i = 0; i < MAX_RUNS_PER_TICK; i++) {
		const response = await env.WEBSITE.fetch(`https://coh1stats.com/api/internal/jobs/${name}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${env.SERVICE_TOKEN}` }
		});
		if (!response.ok) {
			console.error(`[jobs] ${name} failed`, response.status, await response.text());
			return;
		}

		const { processed, more } = (await response.json()) as { processed: number; more: boolean };
		if (processed > 0) {
			console.log(`[jobs] ${name} processed ${processed}`);
		}

		if (!more) {
			return;
		}
	}
}

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		const minute = new Date(controller.scheduledTime).getUTCMinutes();
		const due = JOBS.filter((job) => minute % job.every === job.offset);
		ctx.waitUntil(Promise.all(due.map((job) => run(env, job.name))));
	}
} satisfies ExportedHandler<Env>;
