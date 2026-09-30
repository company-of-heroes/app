export type CommentVoteValue = 1 | -1 | 0;

export function nextCommentVote(current: CommentVoteValue, next: 1 | -1): CommentVoteValue {
	return current === next ? 0 : next;
}

export function nextCommentScore(score: number, current: CommentVoteValue, next: 1 | -1): number {
	if (current === next) {
		return score - next;
	}

	if (current !== 0) {
		return score - current + next;
	}

	return score + next;
}

export function voteFromRecord(value: unknown): 1 | -1 {
	return Number(value) === -1 ? -1 : 1;
}

export function scoreClassName(score: number, zeroClass = 'text-secondary-200'): string {
	if (score > 0) {
		return 'text-green-400';
	}

	if (score < 0) {
		return 'text-red-400';
	}

	return zeroClass;
}

export function compareCommentsByScore(
	a: { likeCount?: number | null; created?: string } | null | undefined,
	b: { likeCount?: number | null; created?: string } | null | undefined
): number {
	const score = (Number(b?.likeCount) || 0) - (Number(a?.likeCount) || 0);
	if (score !== 0) {
		return score;
	}

	return String(a?.created ?? '').localeCompare(String(b?.created ?? ''));
}
