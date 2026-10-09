<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import * as Tabs from '../ui/tabs';

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
		'border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 border-b px-4',
		className
	)}
>
	<Tabs.Root
		value={active}
		onValueChange={(id) => onSelect?.(id)}
		activationMode="manual"
		class="min-w-0"
	>
		<Tabs.List>
			{#each tabs as tab (tab.id)}
				{#if tab.href && !onSelect}
					<Tabs.Trigger value={tab.id}>
						{#snippet child({ props })}
							<a href={tab.href} {...props}>{tab.label}</a>
						{/snippet}
					</Tabs.Trigger>
				{:else}
					<Tabs.Trigger value={tab.id}>{tab.label}</Tabs.Trigger>
				{/if}
			{/each}
		</Tabs.List>
	</Tabs.Root>
	{#if trailing}
		{@render trailing()}
	{/if}
</div>
