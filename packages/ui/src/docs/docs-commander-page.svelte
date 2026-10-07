<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import DocsCost from './docs-cost.svelte';
	import DocsEffects from './docs-effects.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsIcon from './docs-icon.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsSection from './docs-section.svelte';
	import type { DocsCommanderPageData } from './types';

	type Props = {
		page: DocsCommanderPageData;
	};

	let { page }: Props = $props();
	const { t } = useI18n();

	const commander = $derived(page.commander);
</script>

<DocsHeader
	name={commander.name}
	icon={commander.icon}
	faction={commander.faction}
	kicker={t('Commander')}
	help={commander.help}
/>

{#key commander.slug}
	<DocsNote kind="commander" slug={commander.slug} note={page.note} />
{/key}

<DocsSection title={t('Commander tree')}>
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		{#each page.branches as tiers, branch (branch)}
			<ol class="space-y-3">
				{#each tiers as tier, index (tier.upgrade.slug)}
					<li class="border-secondary-800 rounded-sm border p-3">
						<div class="flex gap-3">
							<DocsIcon icon={tier.upgrade.icon} name={tier.upgrade.name} />
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<h3 class="font-semibold text-white">
										<span class="text-secondary-500 mr-1 tabular-nums">{index + 1}.</span>
										{tier.upgrade.name}
									</h3>
									<DocsCost cost={tier.upgrade.cost} compact />
								</div>
								{#if tier.upgrade.help}
									<p class="text-secondary-300 mt-1 text-sm">{tier.upgrade.help}</p>
								{/if}
								{#if tier.upgrade.effects?.length}
									<DocsEffects effects={tier.upgrade.effects} class="mt-2" />
								{/if}
							</div>
						</div>
						{#each tier.abilities as ability (ability.slug)}
							<div class="border-secondary-800 mt-3 border-t pt-3">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<span class="text-sm font-semibold text-white">{ability.name}</span>
									<span class="flex items-center gap-3">
										<DocsCost cost={ability.cost} compact />
										{#if ability.recharge}
											<span class="text-secondary-400 text-xs tabular-nums">
												{t('Recharge {seconds}s', { seconds: ability.recharge })}
											</span>
										{/if}
									</span>
								</div>
								{#if ability.help && ability.help !== tier.upgrade.help}
									<p class="text-secondary-400 mt-1 text-sm">{ability.help}</p>
								{/if}
							</div>
						{/each}
						{#if tier.units.length}
							<DocsRefGrid refs={tier.units} class="mt-3 sm:grid-cols-1 lg:grid-cols-1" />
						{/if}
					</li>
				{/each}
			</ol>
		{/each}
	</div>
</DocsSection>
