<script lang="ts">
	import type { Snippet } from 'svelte';
	import type TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadText } from '@company-of-heroes/ui/variants';

	type Props = {
		label: string;
		icon?: typeof TrophyIcon;
		/** Small line under the value. */
		sub?: Snippet | string | null;
		children: Snippet;
		class?: string;
	};

	let { label, icon: Icon, sub, children, class: className }: Props = $props();
</script>

<!-- Draws its own right and bottom line; `PlayerFacts` clips the last right line. -->
<div
	class={cn(
		'border-secondary-800 flex min-w-40 flex-1 basis-44 flex-col gap-1 border-r border-b px-4 py-3',
		className
	)}
>
	<span class={cn(tableHeadText, 'text-secondary-400 flex items-center gap-1.5')}>
		{#if Icon}
			<Icon size={14} weight="fill" class="text-secondary-500" />
		{/if}
		{label}
	</span>
	<div
		class="font-heading flex min-h-7 min-w-0 items-center gap-2 text-base font-bold whitespace-nowrap text-white tabular-nums"
	>
		{@render children()}
	</div>
	{#if typeof sub === 'string'}
		<span class="text-secondary-400 truncate text-xs">{sub}</span>
	{:else if sub}
		<div class="text-secondary-400 flex min-w-0 items-center gap-1.5 truncate text-xs">
			{@render sub()}
		</div>
	{/if}
</div>
