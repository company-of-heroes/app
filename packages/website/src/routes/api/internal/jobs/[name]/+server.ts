import { err, ok } from 'neverthrow';
import { notFound } from '$lib/server/errors';
import { handle, requireService } from '$lib/server/http';
import type { Task } from '$lib/server/result';
import type { Services } from '$lib/server/services';

/**
 * Scheduled work, triggered by the jobs worker (packages/jobs-worker). Each job
 * runs one bounded batch and reports `more` when another run would find work.
 */
const JOBS: Record<string, (services: Services) => Task<{ processed: number; more: boolean }>> = {
	'live-cleanup': (services) => services.liveLobbies.cleanup(),
	'result-fill': (services) => services.matchResults.fill(),
	'ratings-harvest': (services) => services.ratingHarvest.harvestDue(),
	'ladder-harvest': (services) => services.ratingHarvest.harvestLadder(),
	'lobby-merge': (services) => services.lobbies.mergeDuplicates(),
	'rewards-evaluate': (services) => services.rewards.evaluateDue(),
	// One-time (run by hand until done): overlays published before R2.
	'overlay-backfill': (services) => services.overlays.backfill()
};

export const POST = handle((event) =>
	requireService(event)
		.andThen(() => {
			const job = JOBS[event.params.name ?? ''];
			return job ? ok(job) : err(notFound('Unknown job'));
		})
		.asyncAndThen((job) => job(event.locals.services))
);
