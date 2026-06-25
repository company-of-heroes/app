<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { useComments } from '../comments/context.svelte';
	import ThumbsUp from 'phosphor-svelte/lib/ThumbsUp';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';

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
			const updated = await app.database.comments.toggleLike(comment.current);
			comment.setComment({ ...comment.current, ...updated });
			comments.replace(comment.current!);
		} catch (error) {
			console.error('Failed to toggle like:', error);
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
		comment.current?.likes.includes(app.features.auth.userId) && 'text-blue-400',
		restProps.class
	)}
	onclick={toggle}
>
	<ThumbsUp size={24} weight="fill" />
	<span>{comment.current?.likes.length || 0}</span>
</button>
