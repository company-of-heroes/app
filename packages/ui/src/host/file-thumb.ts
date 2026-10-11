/**
 * Adds PocketBase's `?thumb=` to a PocketBase file url (`/api/files/…`), so lists load a small
 * image instead of the original. Other urls (Steam, data URIs) come back unchanged.
 */
export function withFileThumb(url: string, thumb: string | undefined): string {
	if (!thumb || !url.includes('/api/files/') || /[?&]thumb=/.test(url)) {
		return url;
	}

	return `${url}${url.includes('?') ? '&' : '?'}thumb=${encodeURIComponent(thumb)}`;
}
