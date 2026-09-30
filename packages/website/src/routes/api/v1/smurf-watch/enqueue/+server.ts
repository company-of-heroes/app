import { z } from 'zod';
import { errAsync, ok } from 'neverthrow';
import { badRequest } from '$lib/server/errors';
import { handle, parseBody, requireService } from '$lib/server/http';
import { SMURF_SOURCE_PRIORITY, type SmurfSource } from '$lib/server/services/smurf';

const body = z.object({
	steam_id: z
		.string()
		.regex(/^\d{17}$/, 'steam_id must be a 17-digit SteamID64')
		.optional(),
	steamId: z
		.string()
		.regex(/^\d{17}$/, 'steam_id must be a 17-digit SteamID64')
		.optional(),
	profile_id: z.coerce.number().int().optional(),
	profileId: z.coerce.number().int().optional(),
	source: z.string().optional(),
	priority: z.coerce.number().optional(),
	lender_steam_id: z.string().optional(),
	lenderSteamId: z.string().optional(),
	lender_source: z.string().optional(),
	lenderSource: z.string().optional()
});

/**
 * Queues a Steam account for smurf screening. Reporting who lends the account
 * (closing the case) needs a signed-in user or the service token.
 */
export const POST = handle((event) =>
	parseBody(body, event.request).andThen((input) => {
		const steamId = input.steam_id ?? input.steamId;
		if (!steamId) {
			return errAsync(badRequest('steam_id must be a 17-digit SteamID64'));
		}

		const source: SmurfSource =
			input.source && input.source in SMURF_SOURCE_PRIORITY
				? (input.source as SmurfSource)
				: 'profile';
		const profileId = input.profile_id ?? input.profileId ?? null;
		const lenderSteamId = input.lender_steam_id ?? input.lenderSteamId;
		const { smurf } = event.locals.services;

		if (lenderSteamId) {
			return (event.locals.user ? ok(undefined) : requireService(event))
				.asyncAndThen(() =>
					smurf.markLender({
						steamId,
						profileId,
						source,
						lenderSteamId,
						lenderSource: input.lender_source ?? input.lenderSource ?? null
					})
				)
				.map((record) => ({
					id: record.id,
					steam_id: record.steam_id,
					status: record.status,
					lender_steam_id: record.lender_steam_id
				}));
		}

		// A caller may lower the priority, never raise it above the source's.
		const max = SMURF_SOURCE_PRIORITY[source];
		const priority =
			input.priority !== undefined && Number.isFinite(input.priority)
				? Math.max(0, Math.min(input.priority, max))
				: max;
		return smurf.enqueue({ steamId, profileId, source, priority }).map((record) => ({
			id: record.id,
			steam_id: record.steam_id,
			status: record.status,
			lender_steam_id: record.lender_steam_id || null
		}));
	})
);
