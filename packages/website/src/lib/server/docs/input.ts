import { z } from 'zod';
import { DOCS_NOTE_MAX, DOCS_REPORT_MAX } from '../services/docs';

export const saveDocsNoteSchema = z.object({
	kind: z.enum(['unit', 'building', 'commander', 'weapon', 'map']),
	slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
	body: z.string().max(DOCS_NOTE_MAX)
});

export const reportDocsIssueSchema = z.object({
	/** Path (with search) of the wiki page, e.g. `/es/wiki/units/riflemen`. */
	path: z.string().max(300),
	page: z.string().max(200),
	description: z.string().trim().min(1).max(DOCS_REPORT_MAX)
});

const WIKI_PATH = /^(\/(es|ko))?\/wiki(\/[a-z0-9-]+)*\/?$/;

/** Absolute URL of a wiki page on `origin`, or null when `path` is not a wiki page there. */
export function wikiUrl(path: string, origin: string): string | null {
	const target = new URL(path, origin);
	return target.origin === new URL(origin).origin && WIKI_PATH.test(target.pathname)
		? `${target.origin}${target.pathname}${target.search}`
		: null;
}
