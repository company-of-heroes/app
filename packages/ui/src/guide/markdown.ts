import { Marked, type Tokens } from 'marked';
import { slugify } from '@company-of-heroes/api/guides';
import { parseWikiRef } from '../docs/wiki-ref';

export type GuideHeading = { id: string; text: string; level: 2 | 3 };

export type RenderGuideOptions = {
	/** Origins images may come from (the PocketBase files host); others are dropped. */
	imageOrigins: string[];
	/** Localizes site paths (`/wiki/...`, `/guides/...`); the host's `href`. */
	href: (path: string) => string;
	/** Url of a wiki icon key (`units_unit_allied_rifleman`); the host's `resolve.actionIcon`. */
	wikiIcon?: (key: string) => string | undefined;
};

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

const EXTERNAL = /^https?:\/\//i;
/** Pages of our own a guide may link to. */
const INTERNAL = /^\/(wiki|guides|players|replays|tournaments|leaderboards|stats)(\/|$)/;

function imageAllowed(href: string, origins: string[]): boolean {
	try {
		return origins.includes(new URL(href).origin);
	} catch {
		return false;
	}
}

/** Plain text of inline tokens, for heading ids. */
function plainText(tokens: Tokens.Generic[]): string {
	return tokens
		.map((token) => {
			if ('tokens' in token && Array.isArray(token.tokens)) {
				return plainText(token.tokens as Tokens.Generic[]);
			}

			return typeof token.text === 'string' ? token.text : '';
		})
		.join('');
}

/**
 * Renders a guide's markdown: headings get ids (for the table of contents), images are kept when
 * they come from our files host, links go to https pages or our own paths. Raw HTML is dropped.
 */
export function renderGuideMarkdown(
	source: string,
	options: RenderGuideOptions
): { html: string; headings: GuideHeading[] } {
	const headings: GuideHeading[] = [];
	const ids = new Map<string, number>();

	/** A wiki icon as a framed tile linking to its page (hover shows the stats popover). */
	const wikiImage = ({ href, text }: Tokens.Image): string | null => {
		const wiki = parseWikiRef(href);
		if (!wiki) {
			return null;
		}

		const src = wiki.icon ? options.wikiIcon?.(wiki.icon) : undefined;
		if (!src) {
			return '';
		}

		const name = escapeHtml(text ?? '');
		return `<a href="${escapeHtml(options.href(wiki.path))}" class="guide-wiki-image" aria-label="${name}"><img src="${escapeHtml(src)}" alt="${name}" loading="lazy" decoding="async"></a>`;
	};

	/** An uploaded image: a figure on its own line, a plain image inside text. */
	const uploadedImage = ({ href, title, text }: Tokens.Image, asFigure: boolean): string => {
		if (!href || !imageAllowed(href, options.imageOrigins)) {
			return '';
		}

		const img = `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}" loading="lazy" decoding="async">`;
		if (!asFigure) {
			return img;
		}

		const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';
		return `<figure>${img}${caption}</figure>`;
	};

	const block = (token: Tokens.Image) => wikiImage(token) ?? uploadedImage(token, true);
	const marked = new Marked({
		async: false,
		breaks: false,
		gfm: true,
		renderer: {
			html() {
				return '';
			},
			heading({ tokens, depth }: Tokens.Heading) {
				const level: 2 | 3 = depth <= 2 ? 2 : 3;
				const text = plainText(tokens as Tokens.Generic[]);
				const base = slugify(text, 'section', 60);
				const seen = ids.get(base) ?? 0;
				ids.set(base, seen + 1);
				const id = seen ? `${base}-${seen + 1}` : base;
				headings.push({ id, text, level });
				return `<h${level} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${level}>`;
			},
			paragraph({ tokens }: Tokens.Paragraph) {
				// A paragraph of only images: one uploaded image is a figure; several images, or wiki
				// tiles, sit next to each other in a row.
				const images = tokens.filter((token): token is Tokens.Image => token.type === 'image');
				const onlyImages =
					images.length > 0 &&
					tokens.every(
						(token) =>
							token.type === 'image' ||
							token.type === 'br' ||
							(token.type === 'text' && !token.raw.trim())
					);
				if (!onlyImages) {
					return `<p>${this.parser.parseInline(tokens)}</p>\n`;
				}

				const blocks = images.map(block).filter(Boolean);
				if (!blocks.length) {
					return '';
				}

				if (blocks.length === 1 && !parseWikiRef(images[0].href)) {
					return blocks[0];
				}

				return `<div class="guide-image-row">${blocks.join('')}</div>\n`;
			},
			image(token: Tokens.Image) {
				return wikiImage(token) ?? uploadedImage(token, false);
			},
			link({ href, title, tokens }: Tokens.Link) {
				const text = this.parser.parseInline(tokens);
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				if (!href) {
					return text;
				}

				if (EXTERNAL.test(href)) {
					return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
				}

				const wiki = parseWikiRef(href);
				if (wiki) {
					const src = wiki.icon ? options.wikiIcon?.(wiki.icon) : undefined;
					const icon = src
						? `<img class="guide-wiki-icon" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`
						: '';
					return `<a href="${escapeHtml(options.href(wiki.path))}" class="guide-wiki-link"${titleAttr}>${icon}${text}</a>`;
				}

				if (INTERNAL.test(href)) {
					return `<a href="${escapeHtml(options.href(href))}"${titleAttr}>${text}</a>`;
				}

				if (href.startsWith('#')) {
					return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
				}

				return text;
			}
		}
	});
	if (!source) {
		return { html: '', headings };
	}

	const html = marked.parse(source, { async: false });
	return { html: typeof html === 'string' ? html : '', headings };
}

/** Only the headings, for a table of contents next to the editor. */
export function guideHeadings(source: string): GuideHeading[] {
	return renderGuideMarkdown(source, { imageOrigins: [], href: (path) => path }).headings;
}
