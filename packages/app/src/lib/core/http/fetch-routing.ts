export function getUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') {
		return input;
	}

	if (input instanceof URL) {
		return input.href;
	}

	return input.url;
}

export function isPocketBaseUrl(url: string, pocketBaseOrigin: string): boolean {
	try {
		return new URL(url).origin === pocketBaseOrigin;
	} catch {
		return false;
	}
}

export function isLocalUrl(url: string): boolean {
	try {
		const { hostname } = new URL(url);
		return (
			hostname === 'localhost' ||
			hostname === '127.0.0.1' ||
			hostname === '::1' ||
			hostname === '[::1]'
		);
	} catch {
		return false;
	}
}

export function shouldUseNativeFetch(url: string, pocketBaseOrigin: string): boolean {
	return isPocketBaseUrl(url, pocketBaseOrigin) || isLocalUrl(url);
}

export const localUrlPattern = /^https?:\/\/((localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?)/i;
