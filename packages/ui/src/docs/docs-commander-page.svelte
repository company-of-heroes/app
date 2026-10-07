<script lang="ts">
	import type { DocAbility } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		accentBlock,
		accentBlockLabel,
		interactive,
		tableHeadText
	} from '@company-of-heroes/ui/variants';
	import LockOpenIcon from 'phosphor-svelte/lib/LockOpenIcon';
	import TimerIcon from 'phosphor-svelte/lib/TimerIcon';
	import { useHost } from '../host/host.context';
	import EffectRows from '../replay/effect-rows.svelte';
	import { doctrineBannerFile } from '../replay/replay-stats';
	import StatChip from '../replay/stat-chip.svelte';
	import DocsCost from './docs-cost.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsIcon from './docs-icon.svelte';
	import DocsLayout from './docs-layout.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsRefRow from './docs-ref-row.svelte';
	import DocsSection from './docs-section.svelte';
	import type { DocsCommanderPageData } from './types';

	type Props = {
		page: DocsCommanderPageData;
	};

	let { page }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const commander = $derived(page.commander);

	/** An ability's own page: the one weapon it fires, else the one unit it calls in. */
	function abilityLink(ability: DocAbility): string | null {
		if (ability.weapons?.length === 1) {
			return `/wiki/weapons/${ability.weapons[0]}`;
		}

		return ability.spawns?.length === 1 ? `/wiki/units/${ability.spawns[0]}` : null;
	}
	const banner = $derived.by(() => {
		const file =
			commander.id === undefined
				? null
				: doctrineBannerFile({ doctrine: commander.id, faction: commander.faction });
		return file ? host.resolve.doctrineBanner(file) : null;
	});
</script>

<DocsHeader
	name={commander.name}
	icon={commander.icon}
	faction={commander.faction}
	kicker={t('Doctrine')}
	help={commander.help}
	{banner}
/>

<DocsLayout>
	{#snippet main()}
		{#key commander.slug}
			<DocsNote kind="commander" slug={commander.slug} note={page.note} />
		{/key}
		<DocsSection title={t('Doctrine tree')} note={t('Command points')}>
			<!-- Like the in-game tree: two branches side by side, unlocked top to bottom. A line links
			the tier icons; each tier lists what it unlocks in a box under its description. -->
			<div class="divide-secondary-800 grid grid-cols-1 lg:grid-cols-2 lg:divide-x">
				{#each page.branches as tiers, branch (branch)}
					<ol class="border-secondary-800 not-last:border-b lg:border-b-0">
						{#each tiers as tier, index (tier.upgrade.slug)}
							<li class="relative flex gap-4 px-4 py-4">
								{#if index > 0}
									<span aria-hidden="true" class="bg-secondary-700 absolute top-0 left-10 h-4 w-px"
									></span>
								{/if}
								{#if index < tiers.length - 1}
									<span
										aria-hidden="true"
										class="bg-secondary-700 absolute top-16 bottom-0 left-10 w-px"
									></span>
								{/if}
								<div class="relative shrink-0 self-start">
									<DocsIcon
										icon={tier.upgrade.icon}
										name={tier.upgrade.name}
										class="border-secondary-700 size-12 border shadow-md shadow-black/40"
									/>
									{#if tier.upgrade.cost?.command}
										<span
											class="border-secondary-700 absolute -right-2 -bottom-1.5 flex size-6 items-center justify-center rounded-sm border bg-gray-950 text-xs font-bold text-yellow-300 tabular-nums"
										>
											<span class="sr-only">{t('Command points')}</span>
											{tier.upgrade.cost.command}
										</span>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p class={cn(tableHeadText, 'text-primary text-[11px]')}>
										{t('Tier {tier}', { tier: index + 1 })}
									</p>
									<h3 class="text-lg leading-tight font-semibold text-white">
										{tier.upgrade.name}
									</h3>
									{#if tier.upgrade.help}
										<p class="text-secondary-300 mt-1 text-sm leading-snug">{tier.upgrade.help}</p>
									{/if}
									{#if tier.upgrade.effects?.length}
										<EffectRows
											effects={tier.upgrade.effects}
											inline
											class="mt-2 text-sm leading-snug"
										/>
									{/if}
									{#if tier.abilities.length || tier.units.length}
										<!-- What the tier unlocks, in the same warm block as a building's upgrades. -->
										<div class={cn(accentBlock, 'mt-3')}>
											<p class={accentBlockLabel}>
												<LockOpenIcon class="size-3.5" weight="fill" />
												{t('Unlocks')}
											</p>
											<ul>
												{#each tier.abilities as ability (ability.slug)}
													{@const abilityHref = abilityLink(ability)}
													<li class="border-secondary-800 flex gap-3 border-t px-4 py-2">
														<DocsIcon icon={ability.icon} name={ability.name} class="size-7" />
														<div class="min-w-0 flex-1">
															<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
																{#if abilityHref}
																	<a
																		href={host.href(abilityHref)}
																		class={cn(
																			interactive,
																			'hover:text-primary decoration-secondary-600 text-sm font-semibold text-white underline underline-offset-4 transition-colors'
																		)}
																	>
																		{ability.name}
																	</a>
																{:else}
																	<p class="text-sm font-semibold text-white">{ability.name}</p>
																{/if}
																<DocsCost cost={ability.cost} />
																{#if ability.recharge}
																	<StatChip
																		icon={TimerIcon}
																		name={t('Recharge')}
																		value={t('{seconds}s', { seconds: ability.recharge })}
																	/>
																{/if}
															</div>
															{#if ability.help && ability.help !== tier.upgrade.help}
																<p class="text-secondary-300 mt-0.5 text-sm leading-snug">
																	{ability.help}
																</p>
															{/if}
														</div>
													</li>
												{/each}
												{#each tier.units as unit (unit.slug)}
													<li class="border-secondary-800 border-t">
														<DocsRefRow ref={unit} compact accent />
													</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				{/each}
			</div>
		</DocsSection>
	{/snippet}
</DocsLayout>
