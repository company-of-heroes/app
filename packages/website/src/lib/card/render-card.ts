import { CARD_HEIGHT, CARD_WIDTH } from './size';

/** The card is laid out at this size and drawn 1200/880× larger (1200×630), so text stays readable. */
export const CARD_LAYOUT_WIDTH = 880;
export const CARD_LAYOUT_HEIGHT = 462;

/** A drawing that takes longer than this gives up (the download then uses the stored PNG). */
const DRAW_TIMEOUT_MS = 20000;

/** Waits until the node's images are decoded (a broken one is left out, not awaited forever). */
function imagesReady(node: HTMLElement): Promise<unknown> {
	return Promise.all(
		[...node.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined))
	);
}

async function draw(node: HTMLElement): Promise<Blob> {
	const [{ toBlob }] = await Promise.all([import('html-to-image'), document.fonts.ready]);
	await imagesReady(node);
	const blob = await toBlob(node, {
		width: CARD_LAYOUT_WIDTH,
		height: CARD_LAYOUT_HEIGHT,
		// Scaled up into an exact 1200×630 canvas, whatever the screen's pixel ratio.
		canvasWidth: CARD_WIDTH,
		canvasHeight: CARD_HEIGHT,
		pixelRatio: 1
	});
	if (!blob) {
		throw new Error('The card could not be drawn');
	}

	return blob;
}

/**
 * Draws the fixed-size card copy (`CARD_LAYOUT_WIDTH` × `CARD_LAYOUT_HEIGHT`) to a 1200×630
 * PNG in the browser. All its images are same-origin (avatars go through /api/image), so the
 * canvas is never tainted. html-to-image is loaded only here, on demand.
 */
export function renderCardPng(node: HTMLElement): Promise<Blob> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error('Drawing the card timed out')), DRAW_TIMEOUT_MS);
	});
	return Promise.race([draw(node), timeout]).finally(() => clearTimeout(timer));
}

/** Stores the owner's card PNG; the server checks the owner, the size and the data. */
export async function uploadCardPng(steamId: string, png: Blob): Promise<void> {
	const response = await fetch(`/api/v1/players/${steamId}/card.png`, {
		method: 'POST',
		headers: { 'content-type': 'image/png' },
		body: png
	});
	if (!response.ok) {
		throw new Error(`Card upload failed (${response.status}): ${await response.text()}`);
	}
}

/** Saves a file from a URL (a blob URL or a same-origin path). */
export function saveUrl(href: string, filename: string): void {
	const link = document.createElement('a');
	link.href = href;
	link.download = filename;
	link.click();
}

/** Saves a PNG through a blob URL. */
export function downloadPng(png: Blob, filename: string): void {
	const url = URL.createObjectURL(png);
	saveUrl(url, filename);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
