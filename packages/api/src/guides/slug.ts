/** `How to start Heavy T1?` → `how-to-start-heavy-t1`; `fallback` when nothing is left. */
export function slugify(value: string, fallback = 'guide', max = 100): string {
	return (
		value
			.normalize('NFKD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, max)
			.replace(/-+$/, '') || fallback
	);
}

/** Minutes to read a markdown body at about 200 words per minute, at least 1. */
export function readingMinutes(body: string): number {
	const words = body
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}
