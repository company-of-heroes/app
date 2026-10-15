import { z } from 'zod';
import {
	GUIDE_BODY_MAX,
	GUIDE_CATEGORY_NAME_MAX,
	GUIDE_EXCERPT_MAX,
	GUIDE_LANGUAGES,
	GUIDE_SEO_DESCRIPTION_MAX,
	GUIDE_SEO_TITLE_MAX,
	GUIDE_SLUG_MAX,
	GUIDE_TITLE_MAX
} from '@company-of-heroes/api';

const id = z.string().min(1).max(15);
export const guideLanguage = z.enum(GUIDE_LANGUAGES);

/** Every field is optional: the editor saves what changed. */
export const guideInput = z.object({
	title: z.string().trim().max(GUIDE_TITLE_MAX).optional(),
	slug: z.string().trim().max(GUIDE_SLUG_MAX).optional(),
	excerpt: z.string().trim().max(GUIDE_EXCERPT_MAX).optional(),
	body: z.string().max(GUIDE_BODY_MAX).optional(),
	categoryId: id.nullable().optional(),
	language: guideLanguage.optional(),
	status: z.enum(['draft', 'published']).optional(),
	seoTitle: z.string().trim().max(GUIDE_SEO_TITLE_MAX).optional(),
	seoDescription: z.string().trim().max(GUIDE_SEO_DESCRIPTION_MAX).optional(),
	noindex: z.boolean().optional(),
	translationOf: id.nullable().optional()
});

export const guideCreateBody = z.object({ language: guideLanguage });

const clearFlags = z.object({ clearCover: z.boolean().optional() });

/** The cover from a multipart body (`readRecordBody`); non-file values are ignored. */
export function guideImagesFrom(data: Record<string, unknown>, files: Record<string, File>) {
	const flags = clearFlags.safeParse(data);
	return {
		cover: files.cover ?? null,
		clearCover: flags.success ? flags.data.clearCover : false
	};
}

export const guideListQuery = z.object({
	language: guideLanguage,
	categoryId: id.optional(),
	page: z.coerce.number().int().min(1).max(500).default(1)
});

export const guideNavQuery = z.object({
	language: guideLanguage,
	categoryId: id.optional()
});

/** `path` is the part after `/guides/` (`wehrmacht/1v1/heavy-t1`), possibly empty. */
export const guideResolveQuery = z.object({
	path: z.string().max(400).default(''),
	language: guideLanguage,
	page: z.coerce.number().int().min(1).max(500).default(1)
});

export const guideTranslationsQuery = z.object({
	language: guideLanguage,
	q: z.string().trim().max(100).default('')
});

export const guideCategoryInput = z.object({
	name: z.string().trim().min(1).max(GUIDE_CATEGORY_NAME_MAX),
	parentId: id.nullable().default(null)
});

export const guideCategoryUpdate = z.object({
	name: z.string().trim().min(1).max(GUIDE_CATEGORY_NAME_MAX).optional(),
	slug: z.string().trim().min(1).max(GUIDE_CATEGORY_NAME_MAX).optional(),
	sort: z.number().int().min(0).max(10_000).optional()
});
