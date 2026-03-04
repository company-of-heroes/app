<script lang="ts">
	import type { CommentsRootProps } from '.';
	import { createComments } from './context.svelte';

	let {
		lobbyId,
		commentId,
		replayId,
		context = $bindable(),
		children,
		...restProps
	}: CommentsRootProps = $props();
	context = createComments();

	$effect(() => {
		context.init(lobbyId, commentId, replayId);
	});
</script>

<div {...restProps}>
	{@render children?.()}
</div>
