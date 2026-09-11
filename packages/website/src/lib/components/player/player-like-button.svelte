<script lang="ts">
	import { page } from '$app/state';
	import {
		CommentVote,
		nextCommentScore,
		nextCommentVote,
		type CommentVoteValue
	} from '@company-of-heroes/ui/comment';
	import { loginRedirectHref } from '$lib/auth/user';
	import { currentLocale, useI18n } from '$lib/i18n';
	import { getMyPlayerVote, setPlayerVote } from '$lib/remote/player-social.remote';
	import { resource, watch } from 'runed';

	type Props = {
		steamId: string;
		likeCount?: number;
	};

	let { steamId, likeCount = 0 }: Props = $props();
	const { t } = useI18n();
	const user = $derived(page.data.user);
	const loginHref = $derived(
		loginRedirectHref(`${page.url.pathname}${page.url.search}`, currentLocale())
	);
	const myVote = resource(
		() => steamId,
		(id) => getMyPlayerVote(id)
	);

	let vote = $state<CommentVoteValue>(0);
	let count = $state(0);
	let voting = $state(false);
	let errorMessage = $state('');

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
		if (!user || voting) {
			return;
		}

		const prevVote = vote;
		const prevCount = count;
		vote = nextCommentVote(prevVote, value);
		count = nextCommentScore(prevCount, prevVote, value);
		voting = true;
		errorMessage = '';
		try {
			const result = await setPlayerVote({ steamId, value });
			vote = result.vote;
			count = result.likeCount;
		} catch {
			vote = prevVote;
			count = prevCount;
			errorMessage = t('Failed to update vote.');
		} finally {
			voting = false;
		}
	}
</script>

<div title={errorMessage || undefined}>
	<CommentVote
		score={count}
		{vote}
		disabled={voting}
		href={user ? undefined : loginHref}
		upvoteLabel={t('Upvote')}
		downvoteLabel={t('Downvote')}
		onvote={user ? (value) => void setVote(value) : undefined}
	/>
</div>
