import { fail, redirect } from '@sveltejs/kit';
import { failFrom } from '$lib/errors/unwrap';
import { localizeHref } from '@company-of-heroes/i18n';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const passwordConfirm = String(form.get('passwordConfirm') ?? '');
		if (password !== passwordConfirm) {
			return fail(400, { message: locals.t('Passwords do not match.'), email });
		}

		if (password.length < 8) {
			return fail(400, { message: locals.t('Password must be at least 8 characters.'), email });
		}

		const result = await locals.services.auth().register(email, password);
		if (result.isErr()) {
			return failFrom(
				{ ...result.error, message: locals.t(result.error.message) },
				{ email }
			);
		}

		redirect(303, localizeHref('/', locals.locale));
	}
};
