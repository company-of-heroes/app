<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { CommentsContext, createComments } from './context.svelte';

	type Props = {
		commentId?: string;
		lobbyId?: string;
		replayId?: string;
		context?: CommentsContext;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		lobbyId,
		commentId,
		replayId,
		context = $bindable(),
		children,
		...restProps
	}: Props = $props();
	context = createComments();

	$effect(() => {
		context.init(lobbyId, commentId, replayId);
	});
</script>

<div {...restProps}>
	{@render children?.()}
</div>
