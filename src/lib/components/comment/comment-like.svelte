<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';
	import PlusSquareIcon from 'phosphor-svelte/lib/PlusSquareIcon';

	type Props = HTMLAttributes<HTMLButtonElement>;

	const { ...restProps }: Props = $props();
	const comment = useComment();
</script>

<button
	{...restProps}
	type="button"
	class={cn(
		'text-secondary-500 flex items-center gap-2',
		'cursor-pointer transition-colors hover:text-white',
		comment.current?.likes.includes(app.features.auth.userId) && 'text-green-200',
		restProps.class
	)}
	onclick={() => {
		if (comment.current?.likes.includes(app.features.auth.userId)) {
			return app.database.comments.removeLike(comment.current!.id);
		}

		return app.database.comments.addLike(comment.current!.id);
	}}
>
	<PlusSquareIcon size={24} weight="fill" />
</button>
