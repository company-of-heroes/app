import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import { unwrapAsync } from '$lib/errors/unwrap';
import { guideSeo } from '$lib/site/guide-seo';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** `/guides`, `/guides/<category>`, `/guides/<category>/<sub>` and `/guides/<…>/<guide>`. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const segments = params.path.split('/').filter(Boolean);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const view = await unwrapAsync(
		locals.services.guides.resolve(segments, locals.locale, locals.user ?? null, page)
	);
	if (view.kind === 'redirect') {
		// The guide moved to another category: its address follows it.
		redirect(301, localizeHref(view.path, locals.locale));
	}

	return { view, seo: view.kind === 'guide' ? guideSeo(view.guide) : undefined };
};
