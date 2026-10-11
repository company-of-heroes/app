<script lang="ts">
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVerticalIcon';
	import type { Snippet } from 'svelte';

	type Props = {
		/** A drag item (`id`) was dropped on another one. */
		onDrop: (source: string, target: string) => void;
		children: Snippet;
	};

	let { onDrop, children }: Props = $props();
</script>

<DragDropProvider
	onDragEnd={(event) => {
		const source = event.operation.source?.id;
		const target = event.operation.target?.id;
		if (event.canceled || source == null || target == null || source === target) {
			return;
		}

		onDrop(String(source), String(target));
	}}
>
	{@render children()}
	<DragOverlay>
		{#snippet children(source)}
			<div
				class="border-primary bg-secondary-900 flex w-max items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium text-white shadow-lg"
			>
				<DotsSixVerticalIcon size={14} class="text-secondary-400" />
				{(source.data as { label?: string } | undefined)?.label ?? ''}
			</div>
		{/snippet}
	</DragOverlay>
</DragDropProvider>
