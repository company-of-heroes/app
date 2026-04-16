<script lang="ts">
	import type { Status } from '$core/app/context';
	import type { Snippet } from 'svelte';
	import { PopoverInfo } from '$lib/components/ui/popover';
	import { cn } from '$lib/utils';
	import { isEmpty } from 'lodash-es';

	type Props = {
		status: Status;
		children: Snippet;
		info?: string;
	};

	let { status, info, children }: Props = $props();
</script>

<div class="flex items-center gap-2 rounded-md border border-gray-600 bg-gray-800 px-4 py-2">
	<span
		class={cn(
			'size-2 rounded-full ring-2',
			status === 'idle' && 'bg-gray-400 ring-gray-600',
			status === 'loading' && 'bg-blue-500 ring-blue-800',
			status === 'success' && 'bg-green-500 ring-green-800',
			status === 'error' && 'bg-red-500 ring-red-800'
		)}
	></span>
	{@render children()}
	{#if info && false === isEmpty(info)}
		<PopoverInfo side="top" size="sm">
			{info}
		</PopoverInfo>
	{/if}
</div>
