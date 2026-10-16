import type { Font } from 'satori/standalone';

/**
 * Glyphs the bundled Nunito Sans (Latin) lacks — Korean, Japanese, Chinese, Cyrillic, Greek,
 * … in aliases or labels — come from Google Fonts' Noto families, subset to the text that
 * needs them. Responses are kept in the Cache API; any failure leaves the glyphs out.
 */
const FAMILIES: Record<string, string> = {
	'ko-KR': 'Noto Sans KR',
	'ja-JP': 'Noto Sans JP',
	'zh-CN': 'Noto Sans SC',
	'zh-TW': 'Noto Sans TC',
	'zh-HK': 'Noto Sans HK',
	'th-TH': 'Noto Sans Thai',
	'ar-AR': 'Noto Sans Arabic',
	'he-IL': 'Noto Sans Hebrew',
	'bn-IN': 'Noto Sans Bengali',
	'ta-IN': 'Noto Sans Tamil',
	'te-IN': 'Noto Sans Telugu',
	'ml-IN': 'Noto Sans Malayalam',
	devanagari: 'Noto Sans Devanagari',
	kannada: 'Noto Sans Kannada'
};
/** Cyrillic, Greek, Vietnamese and other scripts Noto Sans itself covers. */
const DEFAULT_FAMILY = 'Noto Sans';
/** The card's names and numbers are extra bold; one weight serves the rest too. */
const WEIGHT = 800;
const CACHE_SECONDS = 30 * 24 * 60 * 60;

async function cached(url: string): Promise<Response | null> {
	const cache = (caches as unknown as { default: Cache }).default;
	const hit = await cache.match(url);
	if (hit) {
		return hit;
	}

	const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
	if (!response.ok) {
		return null;
	}

	const stored = new Response(await response.arrayBuffer(), {
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
			'cache-control': `public, max-age=${CACHE_SECONDS}`
		}
	});
	await cache.put(url, stored.clone());
	return stored;
}

async function notoFont(family: string, text: string): Promise<Font | null> {
	const css = await cached(
		`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${WEIGHT}&text=${encodeURIComponent(text)}`
	);
	// Without a browser user agent Google serves TrueType, which satori reads (it cannot read woff2).
	const src = (await css?.text())?.match(
		/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/
	)?.[1];
	if (!src) {
		return null;
	}

	const font = await cached(src);
	return font
		? { name: family, data: await font.arrayBuffer(), weight: WEIGHT, style: 'normal' }
		: null;
}

/** satori's hook for text no loaded font can draw. */
export async function loadAdditionalAsset(
	languageCode: string,
	segment: string
): Promise<string | Font[]> {
	if (languageCode === 'emoji') {
		return '';
	}

	try {
		const font = await notoFont(FAMILIES[languageCode] ?? DEFAULT_FAMILY, segment);
		return font ? [font] : [];
	} catch (error) {
		console.warn('[card] no font for', languageCode, error);
		return [];
	}
}
