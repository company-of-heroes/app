import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

function parseProfileId(value: string | null): number | null {
	if (!value) {
		return null;
	}

	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}

	return id;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const a = parseProfileId(url.searchParams.get('a'));
	const b = parseProfileId(url.searchParams.get('b'));

	if (a == null || b == null || a === b) {
		return { a, b, compare: null };
	}

	const compare = await unwrapAsync(locals.services.playerCompare().compare(a, b));
	return { a, b, compare };
};
