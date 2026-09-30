<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, tabTrigger } from '@company-of-heroes/ui/variants';

	export type ReplaySectionTab = {
		id: string;
		label: string;
		href?: string;
	};

	type Props = {
		tabs: ReplaySectionTab[];
		active: string;
		onSelect?: (id: string) => void;
		class?: string;
		trailing?: import('svelte').Snippet;
	};

	let { tabs, active, onSelect, class: className, trailing }: Props = $props();
</script>

<div
	class={cn(
		'border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5',
		className
	)}
>
	<div class="flex flex-wrap items-center gap-2">
		{#each tabs as tab (tab.id)}
			{#if tab.href && !onSelect}
				<a
					href={tab.href}
					class={cn(tabTrigger, interactive)}
					data-state={active === tab.id ? 'active' : undefined}
				>
					{tab.label}
				</a>
			{:else}
				<button
					type="button"
					class={tabTrigger}
					data-state={active === tab.id ? 'active' : undefined}
					onclick={() => onSelect?.(tab.id)}
				>
					{tab.label}
				</button>
			{/if}
		{/each}
	</div>
	{#if trailing}
		{@render trailing()}
	{/if}
</div>
