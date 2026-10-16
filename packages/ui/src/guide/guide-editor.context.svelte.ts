import { Context } from 'runed';
import { slugify } from '@company-of-heroes/api/guides';
import type { HostContext } from '../host/host.context';
import type {
	Guide,
	GuideCategoryTree,
	GuideInput,
	GuideLanguage,
	GuideRevision,
	GuideStatus,
	GuideSummary
} from './types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** What the form edits: a published guide's held changes, or the guide itself. */
function editable(guide: Guide): GuideRevision {
	return (
		guide.revision ?? {
			title: guide.title,
			slug: guide.slug,
			excerpt: guide.excerpt,
			body: guide.body,
			categoryId: guide.category?.id ?? null,
			language: guide.language,
			seoTitle: guide.seoTitle,
			seoDescription: guide.seoDescription,
			noindex: guide.noindex,
			translationOf: guide.translationOf,
			coverUrl: guide.coverUrl
		}
	);
}

/**
 * The guide being edited: the saved guide plus the draft fields of the form. Created once by
 * `GuideEditor`; the sidebar boxes read and change it through `useGuideEditor()`.
 */
export class GuideEditorState {
	guide = $state.raw<Guide>() as Guide;
	categories = $state.raw<GuideCategoryTree[]>([]);
	title = $state('');
	slug = $state('');
	/** The address was typed by hand; stop deriving it from the title. */
	slugTouched = $state(false);
	excerpt = $state('');
	body = $state('');
	categoryId = $state<string | null>(null);
	language = $state<GuideLanguage>('en');
	seoTitle = $state('');
	seoDescription = $state('');
	noindex = $state(false);
	translationOf = $state<string | null>(null);
	/** Title of the picked translation root, for the box. */
	translationLabel = $state<string | null>(null);
	cover = $state<File | null>(null);
	clearCover = $state(false);
	saving = $state(false);
	deleting = $state(false);
	/** Sending for review, or discarding held changes. */
	reviewing = $state(false);

	readonly #host: HostContext;
	readonly #t: Translate;

	constructor(guide: Guide, categories: GuideCategoryTree[], host: HostContext, t: Translate) {
		this.#host = host;
		this.#t = t;
		this.categories = categories;
		this.load(guide);
	}

	/** Takes the saved guide's fields (or its held changes) into the form. */
	load(guide: Guide) {
		const fields = editable(guide);
		this.guide = guide;
		this.title = fields.title;
		this.slug = fields.slug;
		this.slugTouched = !fields.slug.startsWith('untitled-');
		this.excerpt = fields.excerpt;
		this.body = fields.body;
		this.categoryId = fields.categoryId;
		this.language = fields.language;
		this.seoTitle = fields.seoTitle;
		this.seoDescription = fields.seoDescription;
		this.noindex = fields.noindex;
		this.translationOf = fields.translationOf;
		this.cover = null;
		this.clearCover = false;
	}

	get status(): GuideStatus {
		return this.guide.status;
	}

	/** The cover the form starts from: the held one, or the live one. */
	get coverUrl(): string | null {
		return editable(this.guide).coverUrl;
	}

	/** The author asked staff to review it, and staff have not published it since. */
	get inReview(): boolean {
		return this.guide.reviewRequestedAt !== null;
	}

	/** Changes to the published guide wait for staff. */
	get hasRevision(): boolean {
		return this.guide.revision !== null;
	}

	/** The address the guide will have, for the slug field's preview. */
	get categoryPath(): string {
		const all = this.categories.flatMap((top) => [top, ...top.children]);
		return all.find((category) => category.id === this.categoryId)?.path ?? '';
	}

	get dirty(): boolean {
		const saved = editable(this.guide);
		return (
			this.title !== saved.title ||
			this.slug !== saved.slug ||
			this.excerpt !== saved.excerpt ||
			this.body !== saved.body ||
			this.categoryId !== saved.categoryId ||
			this.language !== saved.language ||
			this.seoTitle !== saved.seoTitle ||
			this.seoDescription !== saved.seoDescription ||
			this.noindex !== saved.noindex ||
			this.translationOf !== saved.translationOf ||
			this.cover !== null ||
			this.clearCover
		);
	}

	setTitle(title: string) {
		this.title = title;
		if (!this.slugTouched) {
			this.slug = slugify(title, '');
		}
	}

	setSlug(slug: string) {
		this.slug = slug;
		this.slugTouched = true;
	}

	input(status?: GuideStatus): GuideInput {
		return {
			title: this.title.trim(),
			slug: this.slug.trim() || slugify(this.title, ''),
			excerpt: this.excerpt.trim(),
			body: this.body,
			categoryId: this.categoryId,
			language: this.language,
			seoTitle: this.seoTitle.trim(),
			seoDescription: this.seoDescription.trim(),
			noindex: this.noindex,
			translationOf: this.translationOf,
			...(status ? { status } : {})
		};
	}

	/** Saves the form; `status` also publishes or takes the guide back to draft. */
	async save(status?: GuideStatus): Promise<Guide | null> {
		if (this.saving) {
			return null;
		}

		this.saving = true;
		try {
			const saved = await this.#host.api.guides.update(this.guide.id, this.input(status), {
				cover: this.cover,
				clearCover: this.clearCover
			});
			this.load(saved);
			this.#host.notify.success(
				status === 'published'
					? this.#t('Guide published.')
					: status === 'draft'
						? this.#t('Guide taken back to draft.')
						: saved.revision
							? this.#t('Changes saved. They go live once staff publish them.')
							: this.#t('Guide saved.')
			);
			return saved;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not save the guide.')
			);
			return null;
		} finally {
			this.saving = false;
		}
	}

	/** Saves open changes, then asks staff to review the guide. */
	async requestReview(): Promise<boolean> {
		if (this.reviewing) {
			return false;
		}

		if (this.dirty && !(await this.save())) {
			return false;
		}

		this.reviewing = true;
		try {
			this.load(await this.#host.api.guides.requestReview(this.guide.id));
			this.#host.notify.success(this.#t('Sent to staff for review.'));
			return true;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error
					? this.#t(error.message)
					: this.#t('Could not send the guide for review.')
			);
			return false;
		} finally {
			this.reviewing = false;
		}
	}

	/** Drops the changes that wait for review after a confirmation; the live guide stays. */
	async discardRevision(): Promise<boolean> {
		const sure = await this.#host.notify.confirm(
			this.#t('Discard the changes? The published guide stays as it is.'),
			{ confirm: this.#t('Discard changes'), cancel: this.#t('Keep them'), danger: true }
		);
		if (!sure || this.reviewing) {
			return false;
		}

		this.reviewing = true;
		try {
			this.load(await this.#host.api.guides.discardRevision(this.guide.id));
			this.#host.notify.success(this.#t('Changes discarded.'));
			return true;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not discard the changes.')
			);
			return false;
		} finally {
			this.reviewing = false;
		}
	}

	/** Deletes the guide after a confirmation; resolves true when it is gone. */
	async remove(): Promise<boolean> {
		const sure = await this.#host.notify.confirm(
			this.#t('Delete this guide? Its text and images are removed for good.'),
			{ confirm: this.#t('Delete guide'), cancel: this.#t('Keep it'), danger: true }
		);
		if (!sure) {
			return false;
		}

		this.deleting = true;
		try {
			await this.#host.api.guides.remove(this.guide.id);
			this.#host.notify.success(this.#t('Guide deleted.'));
			return true;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not delete the guide.')
			);
			return false;
		} finally {
			this.deleting = false;
		}
	}

	/** An inline image for the editor; rejects with a user-facing message. */
	async uploadImage(file: File): Promise<{ url: string }> {
		try {
			return await this.#host.api.guides.uploadImage(this.guide.id, file);
		} catch (error) {
			throw new Error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not upload the image.')
			);
		}
	}

	async refreshCategories() {
		this.categories = await this.#host.api.guides.categories();
	}

	/** Adds a category and files the guide under it. */
	async addCategory(name: string, parentId: string | null): Promise<boolean> {
		try {
			const created = await this.#host.api.guides.createCategory({ name, parentId });
			await this.refreshCategories();
			this.categoryId = created.id;
			return true;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not create the category.')
			);
			return false;
		}
	}

	/** Staff: rename a category. */
	async renameCategory(id: string, name: string): Promise<boolean> {
		try {
			await this.#host.api.guides.updateCategory(id, { name, slug: name });
			await this.refreshCategories();
			return true;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not save the category.')
			);
			return false;
		}
	}

	/** Staff: delete an empty category after a confirmation. */
	async deleteCategory(id: string, name: string): Promise<boolean> {
		const sure = await this.#host.notify.confirm(
			this.#t('Delete the category "{name}"?', { name }),
			{ confirm: this.#t('Delete category'), cancel: this.#t('Keep it'), danger: true }
		);
		if (!sure) {
			return false;
		}

		try {
			await this.#host.api.guides.deleteCategory(id);
			await this.refreshCategories();
			if (this.categoryId === id) {
				this.categoryId = null;
			}

			return true;
		} catch (error) {
			this.#host.notify.error(
				error instanceof Error ? this.#t(error.message) : this.#t('Could not delete the category.')
			);
			return false;
		}
	}

	setTranslation(guide: GuideSummary | null) {
		this.translationOf = guide?.id ?? null;
		this.translationLabel = guide ? `${guide.title} (${guide.language.toUpperCase()})` : null;
	}
}

const context = new Context<GuideEditorState>('<guide-editor />');
export const createGuideEditor = (state: GuideEditorState) => context.set(state);
export const useGuideEditor = () => context.get();
