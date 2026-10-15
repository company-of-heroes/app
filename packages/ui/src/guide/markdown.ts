import { Marked, type Tokens } from 'marked';
import { slugify } from '@company-of-heroes/api/guides';

export type GuideHeading = { id: string; text: string; level: 2 | 3 };

export type RenderGuideOptions = {
	/** Origins images may come from (the PocketBase files host); others are dropped. */
	imageOrigins: string[];
	/** Localizes site paths (`/wiki/...`, `/guides/...`); the host's `href`. */
	href: (path: string) => string;
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
			image({ href, title, text }: Tokens.Image) {
				if (!href || !imageAllowed(href, options.imageOrigins)) {
					return '';
				}

				const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';
				return `<figure><img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}" loading="lazy" decoding="async">${caption}</figure>`;
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
