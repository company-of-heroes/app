import { fail, redirect } from '@sveltejs/kit';
import { failFrom } from '$lib/errors/unwrap';
import { safeInternalPath } from '@company-of-heroes/i18n';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		if (!email || !password) {
			return fail(400, { message: locals.t('Enter your email and password.'), email });
		}

		const result = await locals.services.auth().login(email, password);
		if (result.isErr()) {
			return failFrom(
				{ ...result.error, message: locals.t(result.error.message) },
				{ email }
			);
		}

		redirect(303, safeInternalPath(form.get('redirect'), locals.locale));
	}
};
