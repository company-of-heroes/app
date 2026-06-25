<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { useComments } from '../comments/context.svelte';
	import ThumbsDown from 'phosphor-svelte/lib/ThumbsDown';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';
	import { isEmpty } from 'lodash-es';

	type Props = HTMLAttributes<HTMLButtonElement>;

	const { ...restProps }: Props = $props();
	const comment = useComment();
	const comments = useComments();

	let isPending = $state(false);

	const toggle = async () => {
		if (!comment.current || isPending) {
			return;
		}

		isPending = true;

		try {
			const updated = await app.database.comments.toggleDislike(comment.current);
			comment.setComment({ ...comment.current, ...updated });
			comments.replace(comment.current!);
		} catch (error) {
			console.error('Failed to toggle dislike:', error);
		} finally {
			isPending = false;
		}
	};
</script>

<button
	{...restProps}
	type="button"
	class={cn(
		'text-secondary-300 flex items-center gap-2',
		'cursor-pointer transition-colors hover:text-white',
		comment.current?.dislikes.includes(app.features.auth.userId) && 'text-red-400',
		restProps.class
	)}
	onclick={toggle}
>
	<ThumbsDown size={24} weight="fill" />
	{#if isEmpty(comment.current?.dislikes)}
		<span>{0}</span>
	{:else}
		<span>-{comment.current!.dislikes.length}</span>
	{/if}
</button>
