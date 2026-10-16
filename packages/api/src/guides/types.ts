import { IMAGE_TYPES } from '../upload-file';

export const GUIDE_LANGUAGES = ['en', 'es', 'ko'] as const;
export type GuideLanguage = (typeof GUIDE_LANGUAGES)[number];

export type GuideStatus = 'draft' | 'published';

export const GUIDE_TITLE_MAX = 200;
export const GUIDE_SLUG_MAX = 140;
export const GUIDE_EXCERPT_MAX = 300;
export const GUIDE_BODY_MAX = 100_000;
export const GUIDE_SEO_TITLE_MAX = 70;
export const GUIDE_SEO_DESCRIPTION_MAX = 160;
export const GUIDE_CATEGORY_NAME_MAX = 80;
export const GUIDE_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const GUIDE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Inline images one guide can hold. */
export const GUIDE_IMAGES_MAX = 30;
export const GUIDE_IMAGE_TYPES = IMAGE_TYPES;
/** Paths next to `/guides/[...path]`: a category or guide with this slug could not be opened. */
export const GUIDE_RESERVED_SLUGS = ['manage'];
/** Guides per page on category pages. */
export const GUIDES_PER_PAGE = 20;

export type GuideCategory = {
	id: string;
	name: string;
	slug: string;
	/** Top-level categories have none. */
	parent: string | null;
	sort: number;
	/** `wehrmacht` or `wehrmacht/1v1`: the category's place under `/guides/`. */
	path: string;
};

/** A top-level category with its subcategories (two levels at most). */
export type GuideCategoryTree = GuideCategory & { children: GuideCategory[] };

export type GuideAuthor = {
	id: string;
	name: string;
	avatarUrl: string | null;
	/** The author's first linked Steam ID: their player profile and labels. */
	steamId: string | null;
};

export type GuideSummary = {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	coverUrl: string | null;
	/** Smaller cover for lists and cards. */
	coverThumbUrl: string | null;
	category: GuideCategory | null;
	language: GuideLanguage;
	status: GuideStatus;
	/** ISO date; null while a draft. */
	publishedAt: string | null;
	updated: string;
	author: GuideAuthor;
	/** Unlocalized page path (`/guides/wehrmacht/1v1/heavy-t1`); null while uncategorized. */
	path: string | null;
	readingMinutes: number;
	/** ISO date the author asked staff to review it; null when nothing waits for review. */
	reviewRequestedAt: string | null;
	/** A published guide with changes that wait for staff (see `Guide.revision`). */
	hasRevision: boolean;
};

export type GuideTranslation = { language: GuideLanguage; path: string };

export type Guide = GuideSummary & {
	/** Markdown. */
	body: string;
	/** Inline images uploaded to this guide. */
	images: { name: string; url: string }[];
	seoTitle: string;
	seoDescription: string;
	noindex: boolean;
	/** The guide this one translates (the group's root), or null. */
	translationOf: string | null;
	/** Published guides in other languages of the same group. */
	translations: GuideTranslation[];
	/** The viewer may edit it (staff, or its author). */
	canEdit: boolean;
	/** Changes to the published guide that go live once staff publish them; only for `canEdit`. */
	revision: GuideRevision | null;
};

/** The editable fields of a published guide's held changes. */
export type GuideRevision = {
	title: string;
	slug: string;
	excerpt: string;
	body: string;
	categoryId: string | null;
	language: GuideLanguage;
	seoTitle: string;
	seoDescription: string;
	noindex: boolean;
	translationOf: string | null;
	/** The cover the changes show: a new one, the live one, or null when they remove it. */
	coverUrl: string | null;
};

export type GuideInput = Partial<{
	title: string;
	slug: string;
	excerpt: string;
	body: string;
	categoryId: string | null;
	language: GuideLanguage;
	status: GuideStatus;
	seoTitle: string;
	seoDescription: string;
	noindex: boolean;
	translationOf: string | null;
}>;

/** Only the cover that changes: a file to upload, or a flag to clear it. */
export type GuideImages = {
	cover?: File | null;
	clearCover?: boolean;
};

export type GuideListQuery = {
	language: GuideLanguage;
	/** A category and its subcategories. */
	categoryId?: string;
	page?: number;
};

export type GuideList = {
	items: GuideSummary[];
	page: number;
	perPage: number;
	total: number;
};

/** The left sidebar: the category tree, and every published guide of the language (by title). */
export type GuideNav = {
	tree: GuideCategoryTree[];
	guides: GuideSummary[];
	categoryId: string | null;
	guideId: string | null;
};

export type GuideView =
	| { kind: 'index'; latest: GuideSummary[]; nav: GuideNav }
	| {
			kind: 'category';
			category: GuideCategory;
			parent: GuideCategory | null;
			children: GuideCategory[];
			list: GuideList;
			nav: GuideNav;
	  }
	| { kind: 'guide'; guide: Guide; nav: GuideNav };

/** What a `/guides/...` path shows, or where its guide moved to. */
export type GuideResolution = GuideView | { kind: 'redirect'; path: string };

export type GuideCategoryInput = {
	name: string;
	/** A top-level category's id, or null for a new top-level one. */
	parentId: string | null;
};

export type GuideCategoryUpdate = Partial<{ name: string; slug: string; sort: number }>;
