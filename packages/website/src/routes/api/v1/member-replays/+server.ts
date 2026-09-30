import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { badRequest } from '$lib/server/errors';
import { handle, parse, parseQuery, readRecordBody, requireUser } from '$lib/server/http';
import { ensure } from '$lib/server/result';
import { memberUploadSchema } from '$lib/server/domain/member-replay-writes';

const querySchema = z.object({
	page: z.coerce.number().int().min(1).catch(1),
	perPage: z.coerce.number().int().min(1).max(50).catch(30),
	ranked: z.stringbool().catch(false),
	title: z.string().trim().max(200).catch(''),
	maps: z
		.string()
		.optional()
		.transform((value) =>
			value
				? value
						.split(',')
						.map((map) => map.trim())
						.filter(Boolean)
				: []
		)
		.catch([]),
	filter: z
		.string()
		.optional()
		.transform((value): unknown => {
			try {
				return value ? JSON.parse(value) : null;
			} catch {
				return null;
			}
		}),
	sort: z.enum(['createdAt', 'likeCount', 'downloadCount', 'commentCount']).catch('createdAt'),
	sortDir: z.enum(['asc', 'desc']).catch('desc')
});

export const GET = handle(({ url, locals, setHeaders }) => {
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	return parseQuery(querySchema, url)
		.asyncAndThen((query) => locals.services.memberReplays.list(query, viewer))
		.map((list) => {
			// Staff lists include soft-deleted rows.
			setHeaders({
				'cache-control': viewer?.isStaff
					? 'private, no-store'
					: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
			});
			return list;
		});
});

/** Upload: multipart `file` plus the metadata the analyzer parsed from it. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			ensure(files.file, badRequest('Replay file is required.'))
				.andThen(() => parse(memberUploadSchema, data))
				.asyncAndThen((input) =>
					event.locals.services.memberReplays.upload(user.id, files.file, input)
				)
		)
	)
);
