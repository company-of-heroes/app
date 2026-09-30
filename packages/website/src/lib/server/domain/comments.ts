/** Comment text helpers. Mentions are stored as `@[Name](mention:<userId>)` (optionally `:<n>`). */

const MENTION = /@\[([^\]]+)\]\(mention:([a-z0-9]{15})(?::\d+)?\)/g;
const MAX_MENTIONS = 10;

/** Replies nest at most this deep. */
export const MAX_COMMENT_DEPTH = 8;

export function mentionedUserIds(text: string): string[] {
	const ids = new Set<string>();
	for (const match of text.matchAll(MENTION)) {
		ids.add(match[2]);
		if (ids.size >= MAX_MENTIONS) {
			break;
		}
	}
	return [...ids];
}

/** Plain-text preview for notifications: mentions as "@Name", whitespace collapsed, max 280 chars. */
export function commentSnippet(text: string): string {
	const plain = text.replace(MENTION, '@$1').replace(/\s+/g, ' ').trim();
	return plain.length <= 280 ? plain : `${plain.slice(0, 277)}...`;
}
