<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';

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
		comment.current?.likes.includes(app.features.auth.userId) && 'text-blue-400',
		restProps.class
	)}
	onclick={() => {
		if (comment.current?.likes.includes(app.features.auth.userId)) {
			return;
		}

		app.database.comments.addLike(comment.current!.id);
	}}
>
	<CaretUpIcon size={24} weight="fill" />
</button>
