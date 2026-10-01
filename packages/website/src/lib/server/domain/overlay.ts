import { unzipSync } from 'fflate';

/** A published OBS overlay: a static site (index.html + assets) per user, served by the api-gateway. */

const MAX_BUNDLE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;

export const CONTENT_TYPES: Record<string, string> = {
	html: 'text/html; charset=utf-8',
	js: 'application/javascript; charset=utf-8',
	mjs: 'application/javascript; charset=utf-8',
	css: 'text/css; charset=utf-8',
	json: 'application/json; charset=utf-8',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	woff: 'font/woff',
	woff2: 'font/woff2',
	ico: 'image/x-icon'
};

export function contentTypeOf(path: string): string {
	return CONTENT_TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

export type OverlayBundle = { files: Map<string, Uint8Array>; version: string };

/** Safe relative path inside the bundle, or null (absolute, `..`, directories). */
function bundlePath(name: string): string | null {
	const path = name.replace(/\\/g, '/').replace(/^\.?\/+/, '');
	if (!path || path.endsWith('/') || path.split('/').some((part) => part === '..' || part === '')) {
		return null;
	}

	return path;
}

/** Unzips and checks an uploaded overlay bundle; throws a user-facing message when it is not usable. */
export function readOverlayBundle(zip: Uint8Array): OverlayBundle {
	if (zip.byteLength > MAX_BUNDLE_BYTES) {
		throw new Error('Overlay bundle is too large.');
	}

	// Limits are checked on the sizes the zip declares, before anything is inflated
	// (fflate inflates each entry into a buffer of exactly that size).
	let declared = 0;
	let count = 0;
	let tooLarge = false;
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(zip, {
			filter: (file) => {
				if (!bundlePath(file.name)) {
					return false;
				}

				count += 1;
				declared += file.originalSize;
				tooLarge ||= count > MAX_FILES || declared > MAX_UNZIPPED_BYTES;
				return !tooLarge;
			}
		});
	} catch {
		throw new Error('Overlay bundle is not a valid zip file.');
	}

	if (tooLarge) {
		throw new Error('Overlay bundle is too large.');
	}

	const files = new Map<string, Uint8Array>();
	let total = 0;
	for (const [name, bytes] of Object.entries(entries)) {
		const path = bundlePath(name);
		if (!path) {
			continue;
		}

		total += bytes.byteLength;
		files.set(path, bytes);
	}
	if (files.size > MAX_FILES || total > MAX_UNZIPPED_BYTES) {
		throw new Error('Overlay bundle is too large.');
	}

	if (!files.has('index.html')) {
		throw new Error('Bundle must contain index.html');
	}

	let version = '';
	try {
		version = String(
			JSON.parse(new TextDecoder().decode(files.get('overlay-version.json'))).version ?? ''
		);
	} catch {
		// no version file
	}
	return { files, version };
}
