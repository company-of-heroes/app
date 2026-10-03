import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { handle, parseQuery } from '$lib/server/http';
import { filterAstSchema, flatParamsToAst } from '$lib/server/domain/history-filter';

const csv = <T extends z.ZodType>(item: T) =>
	z.preprocess(
		(value) =>
			typeof value === 'string' && value
				? value
						.split(',')
						.map((part) => part.trim())
						.filter(Boolean)
				: [],
		z.array(item)
	);

const compareOp = z.enum(['gt', 'gte', 'lt', 'lte']);
const optionalNumber = z.preprocess(
	(value) => (value === '' || value === undefined ? undefined : value),
	z.coerce.number().finite().optional()
);

const querySchema = z.object({
	scope: z.enum(['user', 'community']).default('user'),
	page: z.coerce.number().int().min(1).catch(1),
	perPage: z.coerce.number().int().min(1).max(50).catch(15),
	filter: z
		.string()
		.optional()
		.transform((raw, ctx) => {
			if (!raw) {
				return null;
			}

			try {
				return JSON.parse(raw) as unknown;
			} catch {
				ctx.addIssue({ code: 'custom', message: 'filter must be JSON' });
				return z.NEVER;
			}
		})
		.pipe(filterAstSchema.nullable()),
	profileId: z.coerce.number().int().positive().optional().catch(undefined),
	profileOnly: z.stringbool().catch(false),
	includeSkirmish: z.stringbool().catch(false),
	sort: z.enum(['createdAt', 'likeCount', 'downloadCount', 'commentCount']).catch('createdAt'),
	sortDir: z.enum(['asc', 'desc']).catch('desc'),
	// Legacy flat filters, used when `filter` is absent.
	ranked: z.stringbool().catch(false),
	pro: z.stringbool().catch(false),
	playerIds: csv(z.coerce.number().int().positive()).catch([]),
	maps: csv(z.string().max(100)).catch([]),
	races: csv(z.coerce.number().int().min(0).max(3)).catch([]),
	slots: csv(z.coerce.number().int().min(1).max(8)).catch([]),
	matchtypes: csv(z.coerce.number().int()).catch([]),
	exactMatchtypes: z.stringbool().catch(false),
	eloOp: compareOp.optional().catch(undefined),
	elo: optionalNumber.catch(undefined),
	minElo: optionalNumber.catch(undefined),
	maxElo: optionalNumber.catch(undefined),
	durationOp: compareOp.optional().catch(undefined),
	duration: optionalNumber.catch(undefined),
	minDuration: optionalNumber.catch(undefined),
	maxDuration: optionalNumber.catch(undefined)
});

type Query = z.infer<typeof querySchema>;

/** `eloOp`+`elo`, else `minElo` / `maxElo` (same for duration). */
function comparison(
	op: Query['eloOp'],
	value: number | undefined,
	min: number | undefined,
	max: number | undefined
) {
	if (op && value !== undefined) {
		return { op, value };
	}

	if (min !== undefined) {
		return { op: 'gte' as const, value: min };
	}

	if (max !== undefined) {
		return { op: 'lte' as const, value: max };
	}

	return undefined;
}

function filterFrom(query: Query) {
	if (query.filter) {
		return query.filter;
	}

	const duration = comparison(
		query.durationOp,
		query.duration ?? query.minDuration,
		query.minDuration,
		query.maxDuration
	);
	return flatParamsToAst({
		ranked: query.ranked,
		pro: query.pro,
		playerIds: query.playerIds,
		maps: query.maps,
		races: query.races,
		slots: query.slots,
		matchtypes: query.matchtypes,
		exactMatchtypes: query.exactMatchtypes,
		elo: comparison(query.eloOp, query.elo, query.minElo, query.maxElo),
		durationSeconds: duration && duration.value >= 0 ? duration : undefined
	});
}

export const GET = handle(({ url, locals }) =>
	parseQuery(querySchema, url).asyncAndThen((query) => {
		const user = locals.user;
		return locals.services.matchHistory.list(
			{
				scope: query.scope,
				page: query.page,
				perPage: query.perPage,
				filter: filterFrom(query),
				profileId: query.profileId,
				profileOnly: query.profileOnly,
				includeSkirmish: query.includeSkirmish,
				sort: query.sort,
				sortDir: query.sortDir
			},
			user ? { id: user.id, isStaff: isStaffUser(user) } : null
		);
	})
);
