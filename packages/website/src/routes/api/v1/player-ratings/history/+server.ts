import { handle } from '$lib/server/http';

export const GET = handle(({ url, locals }) => {
	const profileId = Number(url.searchParams.get('profileId') ?? '');
	const steamId = url.searchParams.get('steamId')?.trim() || null;
	return locals.services.ratings.history(Number.isFinite(profileId) ? profileId : null, steamId);
});
