import type { ResultAsync } from 'neverthrow';
import { sendV1, type ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import { fromPbPromise } from '../pb';
import type {
	Guide,
	GuideCategory,
	GuideCategoryInput,
	GuideCategoryTree,
	GuideCategoryUpdate,
	GuideImages,
	GuideInput,
	GuideLanguage,
	GuideList,
	GuideListQuery,
	GuideNav,
	GuideResolution,
	GuideSummary
} from './types';

/** Only the cover that changes: the file to upload, or the flag to clear it. */
function imageBody(images: GuideImages): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (images.cover) {
		body.cover = images.cover;
	}

	if (images.clearCover) {
		body.clearCover = true;
	}

	return body;
}

const path = (id: string, rest = '') => `/guides/${encodeURIComponent(id)}${rest}`;

/** Guides on the website's `/api/v1/guides`; editor and staff checks happen there. */
export class GuidesApi {
	constructor(private deps: ApiDeps) {}

	/** The category tree and the guides under the current (sub)category. */
	nav(language: GuideLanguage, categoryId?: string | null): ResultAsync<GuideNav, ApiError> {
		const query = new URLSearchParams({ language });
		if (categoryId) {
			query.set('categoryId', categoryId);
		}

		return fromPbPromise(
			sendV1<GuideNav>(this.deps, `/guides/nav?${query}`),
			'Could not load guides.'
		);
	}

	list(query: GuideListQuery): ResultAsync<GuideList, ApiError> {
		const params = new URLSearchParams({ language: query.language });
		if (query.categoryId) {
			params.set('categoryId', query.categoryId);
		}

		if (query.page) {
			params.set('page', String(query.page));
		}

		return fromPbPromise(
			sendV1<GuideList>(this.deps, `/guides?${params}`),
			'Could not load guides.'
		);
	}

	/** What `/guides/<path>` shows in a language: the index, a category or a guide (or a redirect). */
	resolve(path: string, language: GuideLanguage, page = 1): ResultAsync<GuideResolution, ApiError> {
		const query = new URLSearchParams({ path, language });
		if (page > 1) {
			query.set('page', String(page));
		}

		return fromPbPromise(
			sendV1<GuideResolution>(this.deps, `/guides/resolve?${query}`),
			'Guide not found.'
		);
	}

	/** A guide by id, drafts included for whoever may edit it. */
	get(id: string): ResultAsync<Guide, ApiError> {
		return fromPbPromise(sendV1<Guide>(this.deps, path(id)), 'Guide not found.');
	}

	/** Their own guides; staff: every guide. Newest change first. */
	mine(): ResultAsync<GuideSummary[], ApiError> {
		return fromPbPromise(
			sendV1<GuideSummary[]>(this.deps, '/guides/mine'),
			'Could not load guides.'
		);
	}

	/** Starts an empty draft in a language; images attach to it right away. */
	create(language: GuideLanguage): ResultAsync<Guide, ApiError> {
		return fromPbPromise(
			sendV1<Guide>(this.deps, '/guides', { method: 'POST', body: { language } }),
			'Could not create the guide.'
		);
	}

	update(id: string, input: GuideInput, images: GuideImages = {}): ResultAsync<Guide, ApiError> {
		return fromPbPromise(
			sendV1<Guide>(this.deps, path(id), {
				method: 'PATCH',
				body: { ...input, ...imageBody(images) }
			}),
			'Could not save the guide.'
		);
	}

	/** Uploads an inline image to the guide; the url goes into the body as `![alt](url)`. */
	uploadImage(id: string, file: File): ResultAsync<{ name: string; url: string }, ApiError> {
		return fromPbPromise(
			sendV1<{ name: string; url: string }>(this.deps, path(id, '/images'), {
				method: 'POST',
				body: { file }
			}),
			'Could not upload the image.'
		);
	}

	/** Sends a draft, or a published guide's held changes, to staff for review. */
	requestReview(id: string): ResultAsync<Guide, ApiError> {
		return fromPbPromise(
			sendV1<Guide>(this.deps, path(id, '/review'), { method: 'POST' }),
			'Could not send the guide for review.'
		);
	}

	/** Drops a published guide's held changes. */
	discardRevision(id: string): ResultAsync<Guide, ApiError> {
		return fromPbPromise(
			sendV1<Guide>(this.deps, path(id, '/revision'), { method: 'DELETE' }),
			'Could not discard the changes.'
		);
	}

	remove(id: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1(this.deps, path(id), { method: 'DELETE' }),
			'Could not delete the guide.'
		).map(() => undefined);
	}

	categories(): ResultAsync<GuideCategoryTree[], ApiError> {
		return fromPbPromise(
			sendV1<GuideCategoryTree[]>(this.deps, '/guides/categories'),
			'Could not load categories.'
		);
	}

	/** Editors and staff add a category (top-level, or under a top-level one). */
	createCategory(input: GuideCategoryInput): ResultAsync<GuideCategory, ApiError> {
		return fromPbPromise(
			sendV1<GuideCategory>(this.deps, '/guides/categories', { method: 'POST', body: input }),
			'Could not create the category.'
		);
	}

	/** Staff only. */
	updateCategory(id: string, input: GuideCategoryUpdate): ResultAsync<GuideCategory, ApiError> {
		return fromPbPromise(
			sendV1<GuideCategory>(this.deps, `/guides/categories/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				body: input
			}),
			'Could not save the category.'
		);
	}

	/** Staff only; refused while the category still has guides or subcategories. */
	deleteCategory(id: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1(this.deps, `/guides/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
			'Could not delete the category.'
		).map(() => undefined);
	}

	/** Guides in other languages this one could be a translation of, by title. */
	searchTranslations(
		language: GuideLanguage,
		query: string
	): ResultAsync<GuideSummary[], ApiError> {
		const params = new URLSearchParams({ language, q: query });
		return fromPbPromise(
			sendV1<GuideSummary[]>(this.deps, `/guides/translations?${params}`),
			'Could not search guides.'
		);
	}
}
