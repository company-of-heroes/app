<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as Editor from '$lib/components/editor';
	import { Button } from '../ui/button';
	import { createEditor } from '../editor/context.svelte';

	type Props = { onSubmit?: () => void | Promise<void> } & HTMLAttributes<HTMLDivElement>;

	let { onSubmit, ...restProps }: Props = $props();

	let editor = $state<Editor.EditorContext>(createEditor());
	let isSubmitting = $state<boolean>(false);
</script>

<div {...restProps}>
	<Editor.Root placeholder="Add comment..." bind:editor>
		<div class="border-secondary-800 bg-secondary-800/30 rounded-lg border">
			<div>
				<Editor.Content />
			</div>
			<div class="border-secondary-800 flex items-center gap-2 p-2">
				<div class="flex space-x-1">
					<Editor.Button.Bold />
					<Editor.Button.Italic />
					<Editor.Button.Underline />
				</div>
				<Editor.Button.Divider />
				<div class="flex space-x-1">
					<Editor.Button.Image />
				</div>
				<div class="ml-auto">
					<Button
						variant="secondary"
						onclick={async () => {
							isSubmitting = true;

							try {
								await onSubmit?.();
							} finally {
								isSubmitting = false;
							}
						}}
						disabled={isSubmitting}
						loading={isSubmitting}
					>
						Submit
					</Button>
				</div>
			</div>
		</div>
	</Editor.Root>
</div>
