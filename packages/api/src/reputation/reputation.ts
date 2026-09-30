import type { RecordModel } from 'pocketbase';
import type { ResultAsync } from 'neverthrow';
import type { ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import { fromPbPromise, pbOptions } from '../pb';

export type ReputationTrigger =
	| 'comment_created'
	| 'comment_received_upvote'
	| 'comment_received_downvote'
	| 'comment_cast_upvote'
	| 'comment_cast_downvote'
	| 'replay_received_upvote'
	| 'replay_received_downvote'
	| 'replay_cast_upvote'
	| 'replay_cast_downvote'
	| 'replay_received_download'
	| 'replay_cast_download'
	| 'match_played'
	| 'player_received_upvote'
	| 'player_received_downvote'
	| 'player_cast_upvote'
	| 'player_cast_downvote';

export type ReputationType = RecordModel & {
	name: string;
	score: number;
	sort?: number;
	trigger: ReputationTrigger;
	enabled?: boolean;
};

export type ReputationTriggerCatalogItem = {
	trigger: ReputationTrigger;
	name: string;
	score: number;
};

export const REPUTATION_TRIGGER_CATALOG: ReputationTriggerCatalogItem[] = [
	{ trigger: 'comment_created', name: 'Placed a comment', score: 10 },
	{ trigger: 'comment_received_upvote', name: 'Comment upvoted', score: 5 },
	{ trigger: 'comment_received_downvote', name: 'Comment downvoted', score: -10 },
	{ trigger: 'comment_cast_upvote', name: 'Upvoted a comment', score: 1 },
	{ trigger: 'comment_cast_downvote', name: 'Downvoted a comment', score: 1 },
	{ trigger: 'replay_received_upvote', name: 'Replay upvoted', score: 10 },
	{ trigger: 'replay_received_downvote', name: 'Replay downvoted', score: -5 },
	{ trigger: 'replay_cast_upvote', name: 'Upvoted a replay', score: 1 },
	{ trigger: 'replay_cast_downvote', name: 'Downvoted a replay', score: 1 },
	{ trigger: 'replay_received_download', name: 'Replay downloaded', score: 5 },
	{ trigger: 'replay_cast_download', name: 'Downloaded a replay', score: 2 },
	{ trigger: 'match_played', name: 'Played a match', score: 15 },
	{ trigger: 'player_received_upvote', name: 'Player upvoted', score: 10 },
	{ trigger: 'player_received_downvote', name: 'Player downvoted', score: -5 },
	{ trigger: 'player_cast_upvote', name: 'Upvoted a player', score: 1 },
	{ trigger: 'player_cast_downvote', name: 'Downvoted a player', score: 1 }
];

export class ReputationApi {
	constructor(private deps: ApiDeps) {}

	listReputationTypes(): ResultAsync<ReputationType[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('reputation_types')
				.getFullList<ReputationType>(pbOptions(this.deps, { sort: 'sort,name' })),
			'Failed to load reputation types.'
		);
	}
}
