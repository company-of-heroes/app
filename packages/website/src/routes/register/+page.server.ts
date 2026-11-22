import { fail } from '@sveltejs/kit';
import { failFrom } from '$lib/errors/unwrap';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const passwordConfirm = String(form.get('passwordConfirm') ?? '');
		const captcha = String(form.get('cf-turnstile-response') ?? '');
		if (password !== passwordConfirm) {
			return fail(400, { message: locals.t('Passwords do not match.'), email });
		}

		if (password.length < 8) {
			return fail(400, { message: locals.t('Password must be at least 8 characters.'), email });
		}

		const auth = locals.services.auth;
		const result = await auth
			.verifyTurnstile(captcha, getClientAddress())
			.andThen(() => auth.register(email, password));
		if (result.isErr()) {
			return failFrom({ ...result.error, message: locals.t(result.error.message) }, { email });
		}

		return { sent: true, email: email.trim() };
	}
};
