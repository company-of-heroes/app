/** The player card PNG: Open Graph size, drawn in the supporter's browser. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** A stored card older than this is drawn and uploaded again on the owner's next visit. */
export const CARD_REFRESH_MS = 24 * 60 * 60 * 1000;

/** The stored card PNG of the owner's card page: when it was uploaded and for which data. */
export type CardImageState = {
	/** SHA-256 of the current card data; a stored PNG with another hash is out of date. */
	hash: string;
	stored: { hash: string; updatedAt: string } | null;
};
