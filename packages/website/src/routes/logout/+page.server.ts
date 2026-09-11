import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals }) => {
	redirect(302, localizeHref('/', locals.locale));
};

export const actions: Actions = {
	default: async ({ locals }) => {
		locals.services.auth().logout();
		redirect(303, localizeHref('/', locals.locale));
	}
};
