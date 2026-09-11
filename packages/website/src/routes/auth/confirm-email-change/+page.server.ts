import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ url, locals }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';
	return {
		token,
		message: token ? null : locals.t('Invalid or expired email change link.')
	};
};
