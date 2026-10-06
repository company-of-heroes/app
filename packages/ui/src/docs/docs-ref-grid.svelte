<script lang="ts">
	import type { DocRef } from '@company-of-heroes/game-data/types';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import DocsCost from './docs-cost.svelte';
	import DocsIcon from './docs-icon.svelte';
	import { docsPath } from './format';

	type Props = {
		refs: DocRef[];
		/** Hide costs (e.g. weapon lists). */
		showCost?: boolean;
		class?: string;
	};

	let { refs, showCost = true, class: className }: Props = $props();
	const host = useHost();

	const row = 'border-secondary-800 flex min-w-0 items-center gap-3 rounded-sm border p-2';
</script>

<ul class={cn('grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3', className)}>
	{#each refs as ref (`${ref.kind}:${ref.slug}`)}
		{@const path = docsPath(ref)}
		<li class="min-w-0">
			{#if path}
				<a
					href={host.href(path)}
					class={cn(
						interactive,
						row,
						'hover:border-secondary-600 hover:bg-secondary-900/50 transition-colors'
					)}
				>
					{@render content(ref)}
				</a>
			{:else}
				<div class={row}>
					{@render content(ref)}
				</div>
			{/if}
		</li>
	{/each}
</ul>

{#snippet content(ref: DocRef)}
	<DocsIcon icon={ref.icon} name={ref.name} />
	<span class="min-w-0">
		<span class="block truncate text-sm font-semibold text-white">{ref.name}</span>
		{#if showCost && ref.cost}
			<DocsCost cost={ref.cost} compact class="text-secondary-300" />
		{/if}
	</span>
{/snippet}
