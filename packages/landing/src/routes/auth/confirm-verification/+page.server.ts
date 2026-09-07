import { redirect } from '@sveltejs/kit';
import { syncLocalsUser } from '$lib/hooks/boot';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	const token = url.searchParams.get('token')?.trim() ?? '';
	if (!token) {
		return {
			ok: false as const,
			message: locals.t('Invalid or expired verification link.')
		};
	}

	const result = await locals.services.auth().confirmVerification(token);
	if (result.isErr()) {
		return {
			ok: false as const,
			message: locals.t(result.error.message)
		};
	}

	if (locals.pocketbase.authStore.isValid) {
		try {
			await locals.pocketbase.collection('users').authRefresh();
		} catch {
			// Session may still be valid with a stale verified flag until next refresh.
		}

		syncLocalsUser(event);
		redirect(303, '/account?saved=verified');
	}

	return {
		ok: true as const,
		message: locals.t('Your email has been verified. You can sign in now.')
	};
};
