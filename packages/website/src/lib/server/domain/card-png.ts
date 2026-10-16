import type { PlayerCardData } from '@company-of-heroes/ui/supporter/types';

/** Largest card PNG an owner may upload. */
export const CARD_MAX_BYTES = 1024 * 1024;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a PNG's IHDR chunk; null when the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
	if (bytes.length < 24 || SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
		return null;
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const type = String.fromCharCode(...bytes.subarray(12, 16));
	if (view.getUint32(8) !== 13 || type !== 'IHDR') {
		return null;
	}

	return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** SHA-256 (hex) of the card data: a stored PNG with another hash shows old data. */
export async function cardHash(card: PlayerCardData): Promise<string> {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(JSON.stringify(card))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The request body, or null once it is larger than `max` bytes (stops reading there). */
export async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
	const declared = Number(request.headers.get('content-length') ?? '');
	if (declared > max) {
		return null;
	}

	if (!request.body) {
		return new Uint8Array();
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		size += value.byteLength;
		if (size > max) {
			await reader.cancel();
			return null;
		}

		chunks.push(value);
	}

	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return bytes;
}
