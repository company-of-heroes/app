import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import { internal, notFound } from '$lib/server/errors';
import { handle, requireService } from '$lib/server/http';
import type { Task } from '$lib/server/result';
import type { Services } from '$lib/server/services';

type JobRun = { processed: number; more: boolean };

/**
 * Steps of one job that must not hold each other up: a failing step is logged and the others
 * still run (a missed "starts soon" reminder cannot be sent later). Fails only when all fail.
 */
function independent(steps: Task<JobRun>[]): Task<JobRun> {
	return ResultAsync.combine(
		steps.map((step) =>
			step
				.map((run): JobRun | null => run)
				.orElse((error) => {
					console.error('job step failed', error);
					return okAsync(null);
				})
		)
	).andThen((runs) => {
		const done = runs.filter((run): run is JobRun => run !== null);
		if (done.length === 0) {
			return errAsync(internal('Every step of the job failed'));
		}

		return okAsync({
			processed: done.reduce((sum, run) => sum + run.processed, 0),
			more: done.some((run) => run.more)
		});
	});
}

/**
 * Scheduled work, triggered by the jobs worker (packages/jobs-worker). Each job
 * runs one bounded batch and reports `more` when another run would find work.
 */
const JOBS: Record<
	string,
	(services: Services, params: URLSearchParams) => Task<{ processed: number; more: boolean }>
> = {
	'live-cleanup': (services) => services.liveLobbies.cleanup(),
	'result-fill': (services) => services.matchResults.fill(),
	'ratings-harvest': (services) => services.ratingHarvest.harvestDue(),
	'ladder-harvest': (services) => services.ratingHarvest.harvestLadder(),
	'lobby-merge': (services) => services.lobbies.mergeDuplicates(),
	'rewards-evaluate': (services) => services.rewards.evaluateDue(),
	// Tournament matches: scores from the Relic results of started tournament games.
	'tournament-sync': (services) => services.tournaments.sync(),
	// Tournament matches past their deadline (one notice to staff each), the players'
	// notices ("starts soon", "your next match is ready", "you are out"), registration closing
	// at its closing time, and "your match starts soon" for agreed match times.
	'tournament-deadlines': (services) =>
		independent([
			services.tournamentGames.notifyOverdue(),
			services.tournamentNotices.run(),
			services.tournaments.closeDue().map((processed) => ({ processed, more: false })),
			services.tournamentSchedule.remind().map((processed) => ({ processed, more: false }))
		]),
	// Ready-made statistics for every preset period, so no visitor waits for a rebuild.
	'statistics-snapshot': (services) => services.statistics.refreshSnapshots(),
	// Self-limiting: stored replays without a summary for the statistics, lobbies first, then
	// uploaded replays.
	'replay-stats': (services) =>
		services.lobbies.summarizeReplays().andThen((lobbies) =>
			lobbies.more
				? okAsync(lobbies)
				: services.memberReplays.summarizeUploads().map((uploads) => ({
						processed: lobbies.processed + uploads.processed,
						more: uploads.more
					}))
		),
	// One-time (run by hand until done): overlays published before R2.
	'overlay-backfill': (services) => services.overlays.backfill(),
	// Basic Matches stored as ranked, translated titles; finds nothing once repaired.
	'lobby-reprocess': (services) => services.lobbies.reprocessStale(),
	// One-time (run by hand, pass the returned `after` back): index rows from before the result.
	'index-repair': (services, params) =>
		services.lobbies.repairStaleIndex(params.get('after') ?? ''),
	// One-time (run by hand, pass the returned `after` back): skirmishes stored as other types.
	'replay-skirmish': (services, params) =>
		services.lobbies.markReplaySkirmishes(params.get('after') ?? '')
};

export const POST = handle((event) =>
	requireService(event)
		.andThen(() => {
			const job = JOBS[event.params.name ?? ''];
			return job ? ok(job) : err(notFound('Unknown job'));
		})
		.asyncAndThen((job) => job(event.locals.services, event.url.searchParams))
);
