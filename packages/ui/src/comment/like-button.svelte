<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource, watch } from 'runed';
	import { useHost, type LikeTarget } from '../host/host.context';
	import CommentVote from './comment-vote.svelte';
	import { nextCommentScore, nextCommentVote, type CommentVoteValue } from './vote';

	type Props = {
		target: LikeTarget;
		likeCount?: number;
		onCountChange?: (count: number) => void;
	};

	let { target, likeCount = 0, onCountChange }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const signedIn = $derived(host.auth.user !== null);
	const myVote = resource(
		() => (signedIn && target.id ? `${target.kind}:${target.id}` : null),
		(key) => (key ? host.api.social.getMyVote(target) : Promise.resolve<CommentVoteValue>(0))
	);

	let vote = $state<CommentVoteValue>(0);
	let count = $state(0);
	let voting = $state(false);

	watch(
		() => myVote.current,
		(current) => {
			if (!voting) {
				vote = current ?? 0;
			}
		}
	);

	watch(
		() => likeCount,
		(value) => {
			if (!voting) {
				count = value ?? 0;
			}
		}
	);

	function setCount(value: number) {
		count = value;
		onCountChange?.(value);
	}

	async function setVote(value: 1 | -1) {
		if (!signedIn || voting || !target.id) {
			return;
		}

		const prevVote = vote;
		const prevCount = count;
		vote = nextCommentVote(prevVote, value);
		setCount(nextCommentScore(prevCount, prevVote, value));
		voting = true;
		try {
			const result = await host.api.social.setVote(target, value);
			vote = result.vote;
			setCount(result.likeCount);
		} catch {
			vote = prevVote;
			setCount(prevCount);
			host.notify.error(t('Failed to update vote.'));
		} finally {
			voting = false;
		}
	}
</script>

<CommentVote
	score={count}
	{vote}
	disabled={voting}
	href={signedIn ? undefined : host.routes.login()}
	onvote={signedIn ? (value) => void setVote(value) : undefined}
/>
