<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { onDestroy } from 'svelte';
	import { CommentsContext, createComments } from './context.svelte';

	type Props = {
		commentId?: string;
		matchId?: string;
		context?: CommentsContext;
	} & HTMLAttributes<HTMLDivElement>;

	let { matchId, commentId, context = $bindable(), children, ...restProps }: Props = $props();
	context = createComments();

	$effect(() => {
		context!.init(matchId, commentId);
	});

	onDestroy(() => {
		context?.dispose();
	});
</script>

<div {...restProps}>
	{@render children?.()}
</div>
