<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import ThumbsDown from 'phosphor-svelte/lib/ThumbsDown';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';
	import { isEmpty } from 'lodash-es';

	type Props = HTMLAttributes<HTMLButtonElement>;

	const { ...restProps }: Props = $props();
	const comment = useComment();
</script>

<button
	{...restProps}
	type="button"
	class={cn(
		'text-secondary-300 flex items-center gap-2',
		'cursor-pointer transition-colors hover:text-white',
		comment.current?.dislikes.includes(app.features.auth.userId) && 'text-blue-400',
		restProps.class
	)}
	onclick={() => {
		if (comment.current?.dislikes.includes(app.features.auth.userId)) {
			return;
		}

		app.database.comments.addDislike(comment.current!.id);
	}}
>
	<ThumbsDown size={24} weight="fill" />
	{#if isEmpty(comment.current?.dislikes)}
		<span>{0}</span>
	{:else}
		<span>-{comment.current!.dislikes.length}</span>
	{/if}
</button>
