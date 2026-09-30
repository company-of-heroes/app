import { ClientResponseError } from 'pocketbase';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { voteFromRecord, type CommentVoteValue } from '@company-of-heroes/ui/comment/vote';
import { sendV1, type ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import {
	currentUserId,
	escapePocketBaseString,
	fromPbPromise,
	pbOptions,
	requireAuth
} from '../pb';

export class PlayerSocialApi {
	constructor(private deps: ApiDeps) {}

	getMyVote(steamId: string): ResultAsync<CommentVoteValue, ApiError> {
		return fromPbPromise(this.findMyVote(steamId), 'Failed to load vote.');
	}

	getLikeCount(steamId: string): ResultAsync<number, ApiError> {
		return fromPbPromise(this.loadLikeCount(steamId), 'Failed to load like count.');
	}

	listLikeCounts(steamIds: string[]): ResultAsync<Record<string, number>, ApiError> {
		const ids = [...new Set(steamIds.map((id) => id.trim()).filter(Boolean))];
		if (ids.length === 0) {
			return okAsync({});
		}

		return fromPbPromise(this.loadLikeCounts(ids), 'Failed to load like counts.');
	}

	setPlayerVote(
		steamId: string,
		value: 1 | -1
	): ResultAsync<{ vote: CommentVoteValue; likeCount: number }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(this.setVoteRecord(steamId, auth.value, value), 'Failed to update vote.');
	}

	private async findMyVote(steamId: string): Promise<CommentVoteValue> {
		const userId = currentUserId(this.deps);
		const id = steamId.trim();
		if (!userId || !id) {
			return 0;
		}

		try {
			const existing = await this.deps.pocketbase
				.collection('player_likes')
				.getFirstListItem(
					`steamId = "${escapePocketBaseString(id)}" && user = "${userId}"`,
					pbOptions(this.deps, { fields: 'value' })
				);
			return voteFromRecord(existing.value);
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return 0;
			}

			throw error;
		}
	}

	private async loadLikeCount(steamId: string): Promise<number> {
		const id = steamId.trim();
		if (!id) {
			return 0;
		}

		try {
			const score = await this.deps.pocketbase
				.collection('player_vote_scores')
				.getFirstListItem(
					`steamId = "${escapePocketBaseString(id)}"`,
					pbOptions(this.deps, { fields: 'likeCount' })
				);
			return Number(score.likeCount) || 0;
		} catch {
			return 0;
		}
	}

	private async loadLikeCounts(steamIds: string[]): Promise<Record<string, number>> {
		const counts: Record<string, number> = {};
		for (const id of steamIds) {
			counts[id] = 0;
		}

		const size = 40;
		for (let i = 0; i < steamIds.length; i += size) {
			const chunk = steamIds.slice(i, i + size);
			const filter = chunk.map((id) => `steamId = "${escapePocketBaseString(id)}"`).join(' || ');
			const rows = await this.deps.pocketbase.collection('player_vote_scores').getFullList(
				pbOptions(this.deps, {
					filter,
					fields: 'steamId,likeCount'
				})
			);
			for (const row of rows) {
				const steamId = String(row.steamId || '').trim();
				if (steamId) {
					counts[steamId] = Number(row.likeCount) || 0;
				}
			}
		}

		return counts;
	}

	private setVoteRecord(
		steamId: string,
		_userId: string,
		value: 1 | -1
	): Promise<{ vote: CommentVoteValue; likeCount: number }> {
		// Clicking the same vote again removes it (toggle).
		return sendV1(this.deps, `/players/${encodeURIComponent(steamId.trim())}/vote`, {
			method: 'PUT',
			body: { value, toggle: true }
		});
	}
}
