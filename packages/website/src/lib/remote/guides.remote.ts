import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { canPublishGuides, isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import {
	guideCategoryInput,
	guideCategoryUpdate,
	guideCreateBody,
	guideInput,
	guideListQuery,
	guideNavQuery,
	guideResolveQuery,
	guideTranslationsQuery
} from '$lib/server/guide-params';

const id = z.string().min(1).max(15);

const images = z.object({
	cover: z.instanceof(File).nullable().optional(),
	clearCover: z.boolean().optional()
});

/** Any signed-in user writes guides (their own; the service checks). */
function author() {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	return { services: locals.services, user: locals.user };
}

/** Staff and editors: add guide categories. */
function editor() {
	const { locals } = getRequestEvent();
	if (!locals.user || !canPublishGuides(locals.user)) {
		error(403, locals.t('Only editors and staff can do that.'));
	}

	return { services: locals.services, user: locals.user };
}

function staff() {
	const { locals } = getRequestEvent();
	if (!locals.user || !isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return { services: locals.services, user: locals.user };
}

export const guideNav = query(guideNavQuery, ({ language, categoryId }) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(
		locals.services.guides.nav(language, { categoryId: categoryId ?? null, guideId: null })
	);
});

export const listGuides = query(guideListQuery, (input) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.guides.list(input));
});

/** A command (not a query) so a reload after a change never comes from the query cache. */
export const resolveGuides = command(guideResolveQuery, ({ path, language, page }) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(
		locals.services.guides.resolve(
			path.split('/').filter(Boolean),
			language,
			locals.user ?? null,
			page
		)
	);
});

export const fetchGuide = command(id, (guideId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.guides.get(guideId, locals.user ?? null));
});

export const myGuides = command(() => {
	const { services, user } = author();
	return unwrapAsync(services.guides.mine(user));
});

export const createGuide = command(guideCreateBody, ({ language }) => {
	const { services, user } = author();
	return unwrapAsync(services.guides.create(user, language));
});

export const updateGuide = command(
	z.object({ id, input: guideInput, images }),
	({ id, input, images }) => {
		const { services, user } = author();
		return unwrapAsync(services.guides.update(id, input, images, user));
	}
);

export const uploadGuideImage = command(
	z.object({ id, file: z.instanceof(File) }),
	({ id, file }) => {
		const { services, user } = author();
		return unwrapAsync(services.guides.uploadImage(id, file, user));
	}
);

export const requestGuideReview = command(id, (guideId) => {
	const { services, user } = author();
	return unwrapAsync(services.guides.requestReview(guideId, user));
});

export const discardGuideRevision = command(id, (guideId) => {
	const { services, user } = author();
	return unwrapAsync(services.guides.discardRevision(guideId, user));
});

export const deleteGuide = command(id, (guideId) => {
	const { services, user } = author();
	return unwrapAsync(services.guides.remove(guideId, user));
});

export const listGuideCategories = command(() =>
	unwrapAsync(getRequestEvent().locals.services.guides.tree())
);

export const createGuideCategory = command(guideCategoryInput, (input) => {
	const { services } = editor();
	return unwrapAsync(services.guides.createCategory(input));
});

export const updateGuideCategory = command(
	z.object({ id, input: guideCategoryUpdate }),
	({ id, input }) => {
		const { services } = staff();
		return unwrapAsync(services.guides.updateCategory(id, input));
	}
);

export const deleteGuideCategory = command(id, (categoryId) => {
	const { services } = staff();
	return unwrapAsync(services.guides.deleteCategory(categoryId));
});

export const searchGuideTranslations = command(guideTranslationsQuery, ({ language, q }) => {
	const { services } = author();
	return unwrapAsync(services.guides.searchTranslations(language, q));
});
