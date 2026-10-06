import { err, ok, okAsync } from 'neverthrow';
import { notFound } from '$lib/server/errors';
import { handle, requireService } from '$lib/server/http';
import type { Task } from '$lib/server/result';
import type { Services } from '$lib/server/services';

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
