export function proxiedImageUrl(url: string): string {
	return `/api/image?url=${encodeURIComponent(url)}`;
}

export function flagImageUrl(country: string | null): string | null {
	if (!country) {
		return null;
	}
	return `/api/flag/${country.toUpperCase()}`;
}
