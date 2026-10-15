import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import {
	GUIDE_COVER_MAX_BYTES,
	GUIDE_IMAGE_MAX_BYTES,
	GUIDE_IMAGE_TYPES,
	GUIDE_IMAGES_MAX,
	GUIDE_RESERVED_SLUGS,
	GUIDES_PER_PAGE,
	readingMinutes,
	slugify,
	type Guide,
	type GuideAuthor,
	type GuideCategory,
	type GuideCategoryInput,
	type GuideCategoryTree,
	type GuideCategoryUpdate,
	type GuideImages,
	type GuideInput,
	type GuideLanguage,
	type GuideList,
	type GuideListQuery,
	type GuideNav,
	type GuideResolution,
	type GuideStatus,
	type GuideSummary,
	type GuideTranslation,
	type GuideView
} from '@company-of-heroes/api';
import { canEditGuide, isStaffUser, type AuthUserPublic } from '$lib/auth/user';
import { cached, uncache } from '../cache';
import { badRequest, conflict, forbidden, notFound, type AppError } from '../errors';
import { ensure, fromPb, pbMaybe, type Task } from '../result';
import { Service } from './service';

const CATEGORIES_KEY = 'guides:categories';
/** Guides on the index page. */
const LATEST = 12;

type CategoryRecord = {
	id: string;
	name: string;
	slug: string;
	parent: string;
	sort: number;
};

type AuthorRecord = {
	id: string;
	name: string;
	avatar: string;
	steamIds?: unknown;
	collectionId: string;
	collectionName: string;
};

type GuideRecord = {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	body: string;
	cover: string;
	images: string[];
	category: string;
	language: GuideLanguage;
	status: GuideStatus;
	publishedAt: string;
	seoTitle: string;
	seoDescription: string;
	noindex: boolean;
	translationOf: string;
	author: string;
	updatedBy: string;
	created: string;
	updated: string;
	collectionId: string;
	collectionName: string;
	expand?: { author?: AuthorRecord };
};

export type GuideSitemapEntry = {
	path: string;
	language: GuideLanguage;
	lastmod: string;
	alternates: { locale: GuideLanguage; path: string }[];
};

const PUBLISHED = 'status = "published"';

function categoryViews(records: CategoryRecord[]): GuideCategory[] {
	const byId = new Map(records.map((record) => [record.id, record]));
	const order = (a: CategoryRecord, b: CategoryRecord) =>
		(a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name);
	return [...records].sort(order).map((record) => {
		const parent = record.parent ? byId.get(record.parent) : undefined;
		return {
			id: record.id,
			name: record.name,
			slug: record.slug,
			parent: parent?.id ?? null,
			sort: record.sort ?? 0,
			path: parent ? `${parent.slug}/${record.slug}` : record.slug
		};
	});
}

function buildTree(categories: GuideCategory[]): GuideCategoryTree[] {
	return categories
		.filter((category) => !category.parent)
		.map((category) => ({
			...category,
			children: categories.filter((child) => child.parent === category.id)
		}));
}

const byId = (categories: GuideCategory[]) =>
	new Map(categories.map((category) => [category.id, category]));

/** Guide ids are PocketBase ids; `images+` / `images-` are the SDK's append and remove modifiers. */
type Patch = Record<string, unknown>;

/**
 * Guides: strategy posts by editors and staff, filed under a two-level category tree and
 * published per language. Everything is read and written here with the superuser client;
 * drafts are shown only to their author and staff.
 */
export class GuidesService extends Service {
	private get guides() {
		return this.pb.collection('guides');
	}

	private get categoryCollection() {
		return this.pb.collection('guide_categories');
	}

	categories(): Task<GuideCategory[]> {
		return cached(CATEGORIES_KEY, 60, () =>
			fromPb(
				this.categoryCollection.getFullList<CategoryRecord>({ sort: 'sort,name' }),
				'Could not load categories'
			).map(categoryViews)
		);
	}

	tree(): Task<GuideCategoryTree[]> {
		return this.categories().map(buildTree);
	}

	private author(record: GuideRecord): GuideAuthor {
		const author = record.expand?.author;
		if (!author) {
			return { id: record.author, name: 'Editor', avatarUrl: null, steamId: null };
		}

		return {
			id: author.id,
			name: author.name?.trim() || 'Editor',
			avatarUrl: author.avatar ? this.pb.files.getURL(author, author.avatar) : null,
			steamId:
				Array.isArray(author.steamIds) && author.steamIds.length ? String(author.steamIds[0]) : null
		};
	}

	private summary(record: GuideRecord, categories: Map<string, GuideCategory>): GuideSummary {
		const category = (record.category && categories.get(record.category)) || null;
		const cover = (thumb: string) =>
			record.cover ? this.pb.files.getURL(record, record.cover, { thumb }) : null;
		return {
			id: record.id,
			title: record.title ?? '',
			slug: record.slug,
			excerpt: record.excerpt ?? '',
			coverUrl: cover('1200x630'),
			coverThumbUrl: cover('600x0'),
			category,
			language: record.language,
			status: record.status,
			publishedAt: record.publishedAt || null,
			updated: record.updated,
			author: this.author(record),
			path: category ? `/guides/${category.path}/${record.slug}` : null,
			readingMinutes: readingMinutes(record.body ?? '')
		};
	}

	/** Published guides of the same translation group, in other languages. */
	private translations(
		record: GuideRecord,
		categories: Map<string, GuideCategory>
	): Task<GuideTranslation[]> {
		const root = record.translationOf || record.id;
		return fromPb(
			this.guides.getFullList<GuideRecord>({
				filter: this.pb.filter(
					`(id = {:root} || translationOf = {:root}) && id != {:self} && ${PUBLISHED}`,
					{ root, self: record.id }
				)
			}),
			'Could not load translations'
		).map((records) =>
			records
				.map((other) => this.summary(other, categories))
				.filter((other): other is GuideSummary & { path: string } => other.path !== null)
				.filter((other) => other.language !== record.language)
				.map((other) => ({ language: other.language, path: other.path }))
		);
	}

	private detail(record: GuideRecord, viewer: AuthUserPublic | null): Task<Guide> {
		return this.categories().andThen((categories) => {
			const map = byId(categories);
			return this.translations(record, map).map(
				(translations): Guide => ({
					...this.summary(record, map),
					body: record.body ?? '',
					images: (record.images ?? []).map((name) => ({
						name,
						url: this.pb.files.getURL(record, name)
					})),
					seoTitle: record.seoTitle ?? '',
					seoDescription: record.seoDescription ?? '',
					noindex: Boolean(record.noindex),
					translationOf: record.translationOf || null,
					translations,
					canEdit: canEditGuide(viewer, record)
				})
			);
		});
	}

	private page(
		filter: string,
		params: Record<string, unknown>,
		options: { sort: string; page: number; perPage: number },
		categories: GuideCategory[]
	): Task<GuideList> {
		return fromPb(
			this.guides.getList<GuideRecord>(options.page, options.perPage, {
				filter: this.pb.filter(filter, params),
				sort: options.sort,
				expand: 'author'
			}),
			'Could not load guides'
		).map((result) => {
			const map = byId(categories);
			return {
				items: result.items.map((record) => this.summary(record, map)),
				page: result.page,
				perPage: result.perPage,
				total: result.totalItems
			};
		});
	}

	/** `pb.filter` chokes on undefined params, so the category only goes in when there is one. */
	private publishedIn(language: GuideLanguage, categoryId: string | undefined) {
		if (categoryId) {
			return {
				filter: `${PUBLISHED} && language = {:language} && (category = {:category} || category.parent = {:category})`,
				params: { language, category: categoryId }
			};
		}

		return { filter: `${PUBLISHED} && language = {:language}`, params: { language } };
	}

	/** Published guides in a language, newest first; a category includes its subcategories. */
	list(query: GuideListQuery): Task<GuideList> {
		const { filter, params } = this.publishedIn(query.language, query.categoryId);
		return this.categories().andThen((categories) =>
			this.page(
				filter,
				params,
				{ sort: '-publishedAt', page: query.page ?? 1, perPage: GUIDES_PER_PAGE },
				categories
			)
		);
	}

	/** The left sidebar: the tree with every published guide of the language, by title. */
	nav(
		language: GuideLanguage,
		current: { categoryId: string | null; guideId: string | null }
	): Task<GuideNav> {
		return this.categories().andThen((categories) =>
			this.page(
				`${PUBLISHED} && language = {:language} && category != ""`,
				{ language },
				{ sort: 'title', page: 1, perPage: 500 },
				categories
			).map((list) => ({
				tree: buildTree(categories),
				guides: list.items,
				categoryId: current.categoryId,
				guideId: current.guideId
			}))
		);
	}

	private bySlug(slug: string, language: GuideLanguage): Task<GuideRecord | null> {
		return pbMaybe(
			this.guides.getFirstListItem<GuideRecord>(
				this.pb.filter('slug = {:slug} && language = {:language}', { slug, language }),
				{ expand: 'author' }
			),
			'Guide not found'
		);
	}

	private visible(record: GuideRecord, viewer: AuthUserPublic | null): boolean {
		return record.status === 'published' || canEditGuide(viewer, record);
	}

	/**
	 * What `/guides/<segments>` shows in a language: the index, a category, or a guide. A guide
	 * found under another category than the URL says (it moved) answers with its current path.
	 */
	resolve(
		segments: string[],
		language: GuideLanguage,
		viewer: AuthUserPublic | null,
		page = 1
	): Task<GuideResolution> {
		if (!segments.length) {
			return this.index(language);
		}

		return this.categories().andThen((categories) => {
			const chain: GuideCategory[] = [];
			let parent: string | null = null;
			let used = 0;
			while (used < segments.length && chain.length < 2) {
				const slug = segments[used];
				const next = categories.find((item) => item.slug === slug && item.parent === parent);
				if (!next) {
					break;
				}

				chain.push(next);
				parent = next.id;
				used++;
			}

			const rest = segments.slice(used);
			const current = chain[chain.length - 1];
			if (!current) {
				return this.moved(segments[segments.length - 1], language, viewer, categories);
			}

			if (rest.length === 0) {
				return this.categoryView(current, language, categories, page);
			}

			if (rest.length === 1) {
				return this.guideView(rest[0], current, language, viewer, categories);
			}

			return errAsync(notFound('Guide not found.'));
		});
	}

	private index(language: GuideLanguage): Task<GuideView> {
		const { filter, params } = this.publishedIn(language, undefined);
		return this.categories().andThen((categories) =>
			this.page(
				filter,
				params,
				{ sort: '-publishedAt', page: 1, perPage: LATEST },
				categories
			).andThen((latest) =>
				this.nav(language, { categoryId: null, guideId: null }).map(
					(nav): GuideView => ({ kind: 'index', latest: latest.items, nav })
				)
			)
		);
	}

	private categoryView(
		category: GuideCategory,
		language: GuideLanguage,
		categories: GuideCategory[],
		page: number
	): Task<GuideView> {
		const map = byId(categories);
		return this.list({ language, categoryId: category.id, page }).andThen((list) =>
			this.nav(language, { categoryId: category.id, guideId: null }).map(
				(nav): GuideView => ({
					kind: 'category',
					category,
					parent: category.parent ? (map.get(category.parent) ?? null) : null,
					children: categories.filter((child) => child.parent === category.id),
					list,
					nav
				})
			)
		);
	}

	private guideView(
		slug: string,
		category: GuideCategory,
		language: GuideLanguage,
		viewer: AuthUserPublic | null,
		categories: GuideCategory[]
	): Task<GuideResolution> {
		return this.bySlug(slug, language).andThen((record) => {
			if (!record || !this.visible(record, viewer)) {
				return errAsync(notFound('Guide not found.'));
			}

			if (record.category !== category.id) {
				const path = this.summary(record, byId(categories)).path;
				return path
					? okAsync<GuideResolution, AppError>({ kind: 'redirect', path })
					: errAsync(notFound('Guide not found.'));
			}

			return this.detail(record, viewer).andThen((guide) =>
				this.nav(language, { categoryId: category.id, guideId: record.id }).map(
					(nav): GuideResolution => ({ kind: 'guide', guide, nav })
				)
			);
		});
	}

	/** No category matched: a guide that moved to another category still answers by its slug. */
	private moved(
		slug: string,
		language: GuideLanguage,
		viewer: AuthUserPublic | null,
		categories: GuideCategory[]
	): Task<GuideResolution> {
		return this.bySlug(slug, language).andThen((record) => {
			const path =
				record && this.visible(record, viewer) ? this.summary(record, byId(categories)).path : null;
			return path
				? okAsync<GuideResolution, AppError>({ kind: 'redirect', path })
				: errAsync(notFound('Guide not found.'));
		});
	}

	private load(id: string): Task<GuideRecord> {
		return pbMaybe(
			this.guides.getOne<GuideRecord>(id, { expand: 'author' }),
			'Guide not found'
		).andThen((record) => (record ? okAsync(record) : errAsync(notFound('Guide not found.'))));
	}

	/** A guide by id: published ones for everyone, drafts for whoever may edit them. */
	get(id: string, viewer: AuthUserPublic | null): Task<Guide> {
		return this.load(id).andThen((record) =>
			this.visible(record, viewer)
				? this.detail(record, viewer)
				: errAsync(notFound('Guide not found.'))
		);
	}

	private editable(id: string, viewer: AuthUserPublic): Task<GuideRecord> {
		return this.load(id).andThen((record) =>
			canEditGuide(viewer, record)
				? okAsync(record)
				: errAsync(forbidden('You can only edit your own guides.'))
		);
	}

	/** Staff: every guide; editors: their own. Newest change first. */
	mine(viewer: AuthUserPublic): Task<GuideSummary[]> {
		return this.categories().andThen((categories) =>
			this.page(
				isStaffUser(viewer) ? 'id != ""' : 'author = {:author}',
				{ author: viewer.id },
				{ sort: '-updated', page: 1, perPage: 200 },
				categories
			).map((list) => list.items)
		);
	}

	/** An empty draft; images can be attached to it right away. */
	create(viewer: AuthUserPublic, language: GuideLanguage): Task<Guide> {
		return fromPb(
			this.guides.create<GuideRecord>(
				{
					title: '',
					slug: `untitled-${Date.now().toString(36)}`,
					body: '',
					language,
					status: 'draft',
					noindex: false,
					author: viewer.id,
					updatedBy: viewer.id
				},
				{ expand: 'author' }
			),
			'Could not create the guide'
		).andThen((record) => this.detail(record, viewer));
	}

	private coverFields(images: GuideImages): Result<Patch, AppError> {
		if (images.cover) {
			if (!GUIDE_IMAGE_TYPES.includes(images.cover.type)) {
				return err(badRequest('Use a JPEG, PNG or WebP image.'));
			}

			if (images.cover.size > GUIDE_COVER_MAX_BYTES) {
				return err(badRequest('The cover must be 5 MB or smaller.'));
			}

			return ok({ cover: images.cover });
		}

		return ok(images.clearCover ? { cover: null } : {});
	}

	/** The record fields of an update, before the checks that need the database. */
	private patch(
		record: GuideRecord,
		input: GuideInput,
		categories: GuideCategory[]
	): Result<Patch, AppError> {
		const patch: Patch = { updatedBy: undefined };
		const title = input.title ?? record.title ?? '';
		const language = input.language ?? record.language;
		for (const key of [
			'title',
			'excerpt',
			'body',
			'seoTitle',
			'seoDescription',
			'noindex',
			'language'
		] as const) {
			if (input[key] !== undefined) {
				patch[key] = input[key];
			}
		}

		let slug = record.slug;
		if (input.slug !== undefined) {
			slug = slugify(input.slug || title, '');
			if (!slug) {
				return err(badRequest('Add a title or an address for the guide.'));
			}

			if (GUIDE_RESERVED_SLUGS.includes(slug)) {
				return err(badRequest('That address is reserved.'));
			}

			patch.slug = slug;
		}

		let categoryId = record.category || null;
		if (input.categoryId !== undefined) {
			categoryId = input.categoryId;
			if (categoryId && !categories.some((category) => category.id === categoryId)) {
				return err(badRequest('That category does not exist.'));
			}

			patch.category = categoryId ?? '';
		}

		if (input.status !== undefined) {
			const body = input.body ?? record.body ?? '';
			if (input.status === 'published' && !(title.trim() && body.trim() && categoryId)) {
				return err(badRequest('Add a title, some text and a category before publishing.'));
			}

			patch.status = input.status;
			if (input.status === 'published' && !record.publishedAt) {
				patch.publishedAt = new Date().toISOString();
			}
		}

		if (input.body !== undefined) {
			// Inline images the text no longer shows are dropped from the record.
			const removed = (record.images ?? []).filter((name) => !input.body!.includes(name));
			if (removed.length) {
				patch['images-'] = removed;
			}
		}

		patch.slugLanguage = { slug, language };
		return ok(patch);
	}

	private uniqueSlug(record: GuideRecord, slug: string, language: GuideLanguage): Task<void> {
		if (slug === record.slug && language === record.language) {
			return okAsync(undefined);
		}

		return pbMaybe(
			this.guides.getFirstListItem(
				this.pb.filter('slug = {:slug} && language = {:language} && id != {:id}', {
					slug,
					language,
					id: record.id
				}),
				{ fields: 'id' }
			)
		).andThen((taken) =>
			taken
				? errAsync(conflict('Another guide in this language already uses that address.'))
				: okAsync(undefined)
		);
	}

	/** The group's root guide for a `translationOf` value (null clears it). */
	private translationRoot(record: GuideRecord, target: string | null | undefined): Task<Patch> {
		if (target === undefined) {
			return okAsync({});
		}

		if (!target) {
			return okAsync({ translationOf: '' });
		}

		return this.load(target).andThen((other) => {
			const root = other.translationOf || other.id;
			return root === record.id
				? errAsync(badRequest('A guide cannot be a translation of itself.'))
				: okAsync({ translationOf: root });
		});
	}

	update(id: string, input: GuideInput, images: GuideImages, viewer: AuthUserPublic): Task<Guide> {
		return this.editable(id, viewer).andThen((record) =>
			this.categories().andThen((categories) =>
				this.patch(record, input, categories)
					.andThen((patch) => this.coverFields(images).map((cover) => ({ ...patch, ...cover })))
					.asyncAndThen((patch) => {
						const { slug, language } = patch.slugLanguage as {
							slug: string;
							language: GuideLanguage;
						};
						delete patch.slugLanguage;
						return this.uniqueSlug(record, slug, language)
							.andThen(() => this.translationRoot(record, input.translationOf))
							.map((translation) => ({ ...patch, ...translation, updatedBy: viewer.id }));
					})
					.andThen((patch) =>
						fromPb(
							this.guides.update<GuideRecord>(record.id, patch, { expand: 'author' }),
							'Could not save the guide'
						)
					)
					.andThen((updated) => this.detail(updated, viewer))
			)
		);
	}

	/** An inline image for the editor; the returned url goes into the body. */
	uploadImage(id: string, file: File, viewer: AuthUserPublic): Task<{ name: string; url: string }> {
		return this.editable(id, viewer).andThen((record) =>
			ensure(GUIDE_IMAGE_TYPES.includes(file.type), badRequest('Use a JPEG, PNG or WebP image.'))
				.andThen(() =>
					ensure(file.size <= GUIDE_IMAGE_MAX_BYTES, badRequest('Images must be 5 MB or smaller.'))
				)
				.andThen(() =>
					ensure(
						(record.images ?? []).length < GUIDE_IMAGES_MAX,
						badRequest(`A guide can hold ${GUIDE_IMAGES_MAX} images at most.`)
					)
				)
				.asyncAndThen(() =>
					fromPb(
						this.guides.update<GuideRecord>(record.id, { 'images+': file, updatedBy: viewer.id }),
						'Could not upload the image'
					)
				)
				.andThen((updated) => {
					const name = (updated.images ?? []).find((item) => !(record.images ?? []).includes(item));
					return name
						? okAsync({ name, url: this.pb.files.getURL(updated, name) })
						: errAsync(badRequest('Could not upload the image.'));
				})
		);
	}

	remove(id: string, viewer: AuthUserPublic): Task<void> {
		return this.editable(id, viewer)
			.andThen((record) => fromPb(this.guides.delete(record.id), 'Could not delete the guide'))
			.map(() => undefined);
	}

	private categoryRecord(id: string): Task<CategoryRecord> {
		return pbMaybe(
			this.categoryCollection.getOne<CategoryRecord>(id),
			'Category not found'
		).andThen((record) => (record ? okAsync(record) : errAsync(notFound('Category not found.'))));
	}

	private categoryOf(record: CategoryRecord, categories: GuideCategory[]): GuideCategory {
		const parent = record.parent ? categories.find((item) => item.id === record.parent) : undefined;
		return {
			id: record.id,
			name: record.name,
			slug: record.slug,
			parent: parent?.id ?? null,
			sort: record.sort ?? 0,
			path: parent ? `${parent.slug}/${record.slug}` : record.slug
		};
	}

	private categorySlugFree(
		categories: GuideCategory[],
		slug: string,
		parentId: string | null,
		excludeId?: string
	): Result<void, AppError> {
		if (GUIDE_RESERVED_SLUGS.includes(slug)) {
			return err(badRequest('That name is reserved.'));
		}

		const taken = categories.some(
			(item) => item.slug === slug && item.parent === parentId && item.id !== excludeId
		);
		return taken ? err(conflict('A category with that name already exists here.')) : ok(undefined);
	}

	/** Editors and staff add a top-level category, or one under a top-level category. */
	createCategory(input: GuideCategoryInput): Task<GuideCategory> {
		return this.categories().andThen((categories) => {
			const parent = input.parentId ? categories.find((item) => item.id === input.parentId) : null;
			if (input.parentId && !parent) {
				return errAsync(notFound('Category not found.'));
			}

			if (parent?.parent) {
				return errAsync(badRequest('Subcategories cannot have their own subcategories.'));
			}

			const slug = slugify(input.name, '');
			const siblings = categories.filter((item) => item.parent === (parent?.id ?? null));
			return ensure(slug, badRequest('Give the category a name.'))
				.andThen(() => this.categorySlugFree(categories, slug, parent?.id ?? null))
				.asyncAndThen(() =>
					fromPb(
						this.categoryCollection.create<CategoryRecord>({
							name: input.name,
							slug,
							parent: parent?.id ?? '',
							sort: siblings.reduce((max, item) => Math.max(max, item.sort), -1) + 1
						}),
						'Could not create the category'
					)
				)
				.andThen((record) =>
					uncache(CATEGORIES_KEY).map(() => this.categoryOf(record, categories))
				);
		});
	}

	/** Staff: rename, re-address or reorder a category. */
	updateCategory(id: string, input: GuideCategoryUpdate): Task<GuideCategory> {
		return this.categoryRecord(id).andThen((record) =>
			this.categories().andThen((categories) => {
				const slug = input.slug !== undefined ? slugify(input.slug, '') : record.slug;
				const patch: Patch = {};
				if (input.name !== undefined) {
					patch.name = input.name;
				}

				if (input.slug !== undefined) {
					patch.slug = slug;
				}

				if (input.sort !== undefined) {
					patch.sort = input.sort;
				}

				return ensure(slug, badRequest('Give the category an address.'))
					.andThen(() => this.categorySlugFree(categories, slug, record.parent || null, record.id))
					.asyncAndThen(() =>
						fromPb(
							this.categoryCollection.update<CategoryRecord>(record.id, patch),
							'Could not save the category'
						)
					)
					.andThen((updated) =>
						uncache(CATEGORIES_KEY).map(() => this.categoryOf(updated, categories))
					);
			})
		);
	}

	/** Staff: only an empty category (no guides, no subcategories) can go. */
	deleteCategory(id: string): Task<void> {
		return this.categoryRecord(id).andThen((record) =>
			this.categories()
				.andThen((categories) =>
					ensure(
						!categories.some((item) => item.parent === record.id),
						badRequest('Remove its subcategories first.')
					)
				)
				.andThen(() =>
					fromPb(
						this.guides.getList(1, 1, {
							filter: this.pb.filter('category = {:category}', { category: record.id }),
							fields: 'id'
						}),
						'Could not load guides'
					)
				)
				.andThen((guides) =>
					ensure(guides.totalItems === 0, badRequest('Move or delete its guides first.'))
				)
				.andThen(() =>
					fromPb(this.categoryCollection.delete(record.id), 'Could not delete the category')
				)
				.andThen(() => uncache(CATEGORIES_KEY))
		);
	}

	/** Published guides in other languages, by title, for the translation picker. */
	searchTranslations(language: GuideLanguage, query: string): Task<GuideSummary[]> {
		return this.categories().andThen((categories) =>
			this.page(
				`${PUBLISHED} && language != {:language} && title ~ {:query}`,
				{ language, query },
				{ sort: '-publishedAt', page: 1, perPage: 10 },
				categories
			).map((list) => list.items)
		);
	}

	/** Every category page path (`/guides/wehrmacht`), shown in every locale. */
	categoryPaths(): Task<string[]> {
		return this.categories().map((categories) =>
			categories.map((category) => `/guides/${category.path}`)
		);
	}

	/** Indexable published guides with the published translations they have. */
	sitemapEntries(): Task<GuideSitemapEntry[]> {
		return this.categories().andThen((categories) =>
			fromPb(
				this.guides.getFullList<GuideRecord>({
					filter: `${PUBLISHED} && noindex != true`,
					sort: '-publishedAt'
				}),
				'Could not load guides'
			).map((records) => {
				const map = byId(categories);
				const summaries = records
					.map((record) => ({ record, summary: this.summary(record, map) }))
					.filter((item) => item.summary.path !== null);
				const groups = new Map<string, typeof summaries>();
				for (const item of summaries) {
					const root = item.record.translationOf || item.record.id;
					groups.set(root, [...(groups.get(root) ?? []), item]);
				}

				return summaries.map(({ record, summary }) => {
					const group = groups.get(record.translationOf || record.id) ?? [];
					const seen = new Set<GuideLanguage>();
					return {
						path: summary.path!,
						language: summary.language,
						lastmod: record.updated,
						alternates: group
							.filter((item) => !seen.has(item.summary.language) && seen.add(item.summary.language))
							.map((item) => ({ locale: item.summary.language, path: item.summary.path! }))
					};
				});
			})
		);
	}
}
