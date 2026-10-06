<script lang="ts">
	import type { DocAbility, DocUpgrade } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import DocsCost from './docs-cost.svelte';
	import DocsEffects from './docs-effects.svelte';
	import DocsIcon from './docs-icon.svelte';

	type Props = {
		/** Abilities or upgrades; they have no page of their own. */
		entries: (DocAbility | DocUpgrade)[];
	};

	let { entries }: Props = $props();
	const { t } = useI18n();
</script>

<ul class="divide-secondary-800 divide-y">
	{#each entries as entry (entry.slug)}
		<li class="flex gap-3 py-3 first:pt-0 last:pb-0">
			<DocsIcon icon={entry.icon} name={entry.name} />
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
					<h4 class="font-semibold text-white">{entry.name}</h4>
					<span class="flex flex-wrap items-center gap-3">
						<DocsCost cost={entry.cost} compact />
						{#if 'recharge' in entry && entry.recharge}
							<span class="text-secondary-400 text-xs tabular-nums">
								{t('Recharge {seconds}s', { seconds: entry.recharge })}
							</span>
						{/if}
						{#if 'range' in entry && entry.range}
							<span class="text-secondary-400 text-xs tabular-nums">
								{t('Range {range}', { range: entry.range })}
							</span>
						{/if}
					</span>
				</div>
				{#if entry.help}
					<p class="text-secondary-300 mt-1 text-sm">{entry.help}</p>
				{/if}
				{#if entry.extra}
					<p class="text-secondary-400 mt-1 text-xs">{entry.extra}</p>
				{/if}
				{#if entry.effects?.length}
					<DocsEffects effects={entry.effects} class="mt-2" />
				{/if}
			</div>
		</li>
	{/each}
</ul>
