type Env = { WEBSITE: Fetcher; SERVICE_TOKEN: string };

/**
 * Runs when minute % every === offset (offsets spread the Relic load). `budgetMs` lets a
 * backlog job keep going for most of the minute instead of stopping after a few runs.
 */
const JOBS: { name: string; every: number; offset: number; budgetMs?: number }[] = [
	{ name: 'live-cleanup', every: 1, offset: 0 },
	// Even minutes; replay-stats takes the odd ones, so the two never share a minute.
	{ name: 'result-fill', every: 2, offset: 0 },
	{ name: 'ladder-harvest', every: 5, offset: 2 },
	{ name: 'ratings-harvest', every: 5, offset: 3 },
	{ name: 'lobby-merge', every: 5, offset: 1 },
	// Self-limiting: only lobbies whose stored ranked flag or title is stale; idle afterwards.
	{ name: 'lobby-reprocess', every: 5, offset: 4 },
	// A run stops starting users after ~20 s; the budget keeps a tick inside its minute.
	// Runs claim their page of users up front and drop the ones another run claimed since, so a
	// slow run overlapping the next tick rarely evaluates (or notifies) a user twice.
	{ name: 'rewards-evaluate', every: 1, offset: 0, budgetMs: 30_000 },
	// Auto labels from the 1v1/2v2 ladders (cached by the leaderboard pages).
	{ name: 'label-auto', every: 30, offset: 25 },
	// Every minute, in parallel with the rest; picks up lobbies an earlier result-fill stored.
	{ name: 'tournament-sync', every: 1, offset: 0 },
	// Staff hear about tournament matches past their deadline.
	{ name: 'tournament-deadlines', every: 5, offset: 2 },
	// Rebuilds the stored statistics snapshots (all preset periods + homepage totals). An even
	// minute, clear of replay-stats' 50 s odd-minute runs; minute % 10 = 0 shares only with
	// result-fill and the every-minute jobs, no harvest, merge or reprocess.
	{ name: 'statistics-snapshot', every: 10, offset: 0 },
	// Once a day per ranked ladder; later runs that day find the snapshot and stop at once, and
	// a failed run is retried half an hour later. Clear of the harvests (minute % 5 = 0).
	{ name: 'leaderboard-snapshot', every: 30, offset: 15 },
	// Self-limiting: stored replays without a statistics summary; idle once caught up.
	{ name: 'replay-stats', every: 2, offset: 1, budgetMs: 50_000 }
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
