type Env = { WEBSITE: Fetcher; SERVICE_TOKEN: string };

/**
 * Runs when minute % every === offset (offsets spread the Relic load). `budgetMs` lets a
 * backlog job keep going for most of the minute instead of stopping after a few runs.
 */
const JOBS: { name: string; every: number; offset: number; budgetMs?: number }[] = [
	{ name: 'live-cleanup', every: 1, offset: 0 },
	{ name: 'result-fill', every: 1, offset: 0 },
	{ name: 'ladder-harvest', every: 5, offset: 2 },
	{ name: 'ratings-harvest', every: 5, offset: 3 },
	{ name: 'lobby-merge', every: 5, offset: 1 },
	// Self-limiting: only lobbies whose stored ranked flag or title is stale; idle afterwards.
	{ name: 'lobby-reprocess', every: 5, offset: 4 },
	{ name: 'rewards-evaluate', every: 1, offset: 0 },
	// Self-limiting: stored replays without a statistics summary; idle once caught up.
	{ name: 'replay-stats', every: 1, offset: 0, budgetMs: 50_000 }
];

/** A job reports `more` while work is left; keep one tick well inside the time limit. */
const MAX_RUNS_PER_TICK = 5;

/** Upper bound for budgeted jobs, in case a run returns very fast. */
const MAX_BUDGETED_RUNS = 60;

async function run(env: Env, name: string, budgetMs?: number): Promise<void> {
	const started = Date.now();
	const maxRuns = budgetMs ? MAX_BUDGETED_RUNS : MAX_RUNS_PER_TICK;
	for (let i = 0; i < maxRuns; i++) {
		// Stop before the next tick starts this job again.
		if (budgetMs && i > 0 && Date.now() - started > budgetMs) {
			return;
		}

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
		ctx.waitUntil(Promise.all(due.map((job) => run(env, job.name, job.budgetMs))));
	}
} satisfies ExportedHandler<Env>;
