import { isStaffUser } from '$lib/auth/user';
import { limitDownloads } from '$lib/server/downloads';
import { handle } from '$lib/server/http';

/** Streams a replay file; `?download=1` strips the embedded metadata. */
export const GET = handle((event) => {
	const { locals, params, url } = event;
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	return limitDownloads(event, 'file')
		.andThen(() =>
			locals.services.replays.file(params.id ?? '', viewer, {
				stripMetadata: url.searchParams.get('download') === '1'
			})
		)
		.map(
			(file) =>
				new Response(file.body, {
					headers: {
						'Content-Type': file.contentType,
						'Content-Disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
						'Cache-Control': 'public, max-age=3600'
					}
				})
		);
});
