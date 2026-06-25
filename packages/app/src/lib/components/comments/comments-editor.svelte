<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Editor } from '../ui/editor';
	import { app } from '$core/app/context';
	import { useComments } from './context.svelte';

	type Props = HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();

	const comments = useComments();

	let isSubmitting = $state(false);
	let value = $state('');

	const submit = async (text: string) => {
		if (!comments.matchId || isSubmitting || text.trim() === '') {
			return;
		}

		isSubmitting = true;

		try {
			const comment = await app.database.comments.createForMatch(comments.matchId, text);
			comments.prepend(comment);
			value = '';
		} catch (error) {
			app.toast.error(
				'Failed to post comment: ' + (error instanceof Error ? error.message : error)
			);
		} finally {
			isSubmitting = false;
		}
	};
</script>

<div {...restProps}>
	<Editor placeholder="Add a comment..." bind:value onsubmit={submit} />
</div>
