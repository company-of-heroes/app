export type CommentAuthor = {
	id: string;
	name: string;
	avatarUrl?: string;
	steamIds?: string[];
};

/** Mirrors `LobbyComment` from `@company-of-heroes/api` (ui does not depend on the api package). */
export type LobbyComment = {
	id: string;
	text: string;
	created: string;
	updated: string;
	parent: string;
	likeCount: number;
	vote: 1 | -1 | 0;
	deleted: boolean;
	deletedNote: string;
	user: CommentAuthor;
};

export type MentionUser = {
	id: string;
	name: string;
	avatarUrl?: string;
	steamIds?: string[];
};
