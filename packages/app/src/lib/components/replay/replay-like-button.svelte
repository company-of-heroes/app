<script lang="ts">
	import { app } from '$core/app/context';
	import {
		CommentVote,
		nextCommentScore,
		nextCommentVote,
		type CommentVoteValue
	} from '@company-of-heroes/ui/comment';
	import { useI18n } from '$lib/i18n';
	import { resource, watch } from 'runed';

	type Props = {
		replayId: string;
		likeCount?: number;
		onCountChange?: (count: number) => void;
	};

	let { replayId, likeCount = 0, onCountChange }: Props = $props();
	const { t } = useI18n();
	const myVote = resource(
		() => replayId,
		(id) => app.database.matchSocial.getMyReplayVote(id)
	);

	let vote = $state<CommentVoteValue>(0);
	let count = $state(0);
	let voting = $state(false);

	watch(
		() => myVote.current,
		(current) => {
			if (voting) {
				return;
			}

			vote = current ?? 0;
		}
	);

	watch(
		() => likeCount,
		(value) => {
			if (voting) {
				return;
			}

			count = value ?? 0;
		}
	);

	async function setVote(value: 1 | -1) {
		if (voting) {
			return;
		}

		const prevVote = vote;
		const prevCount = count;
		vote = nextCommentVote(prevVote, value);
		count = nextCommentScore(prevCount, prevVote, value);
		onCountChange?.(count);
		voting = true;
		try {
			const result = await app.database.matchSocial.setReplayVote(replayId, value);
			vote = result.vote;
			count = result.likeCount;
			onCountChange?.(count);
		} catch {
			vote = prevVote;
			count = prevCount;
			onCountChange?.(count);
			app.toast.error(t('Failed to update vote.'));
		} finally {
			voting = false;
		}
	}
</script>

<CommentVote
	score={count}
	{vote}
	disabled={voting}
	upvoteLabel={t('Upvote')}
	downvoteLabel={t('Downvote')}
	onvote={(value) => void setVote(value)}
/>
