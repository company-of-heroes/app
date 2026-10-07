<script lang="ts">
	import type { DocWeaponRow } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		controlBase,
		flushHeader,
		flushHeaderTitle,
		interactive,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { chanceTone } from '../replay/chance-tone';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useHost } from '../host/host.context';
	import DocsBreadcrumb from './docs-breadcrumb.svelte';
	import DocsIcon from './docs-icon.svelte';
	import { formatNumber } from './format';

	type Props = {
		weapons: DocWeaponRow[];
	};

	let { weapons }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const RANGES = ['short', 'medium', 'long'] as const;
	const RANGE_LABELS = { short: 'Short', medium: 'Medium', long: 'Long' } as const;
	const between = (min: number | null | undefined, max: number | null | undefined) =>
		!max
			? null
			: min === max || !min
				? formatNumber(max)
				: `${formatNumber(min)}–${formatNumber(max)}`;

	let search = $state('');

	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(
		query ? weapons.filter((weapon) => weapon.name.toLowerCase().includes(query)) : weapons
	);
</script>

<DocsBreadcrumb current={t('Weapons')} />

<div class="border-secondary-800 border-b px-4 py-6">
	<h1 class="font-heading text-3xl font-bold text-white">{t('Weapons')}</h1>
	<div class="mt-5">
		<label class={cn(controlBase, 'flex w-full items-center sm:w-58')}>
			<MagnifyingGlassIcon class="text-secondary-500 ml-3 size-4 shrink-0" />
			<input
				type="search"
				placeholder={t('Search weapons...')}
				bind:value={search}
				class="placeholder:text-secondary-500 min-w-0 flex-1 bg-transparent px-3 text-sm text-white focus:outline-none"
			/>
		</label>
	</div>
</div>

<!-- The tables on /stats: a sticky grey header row, flush rows, numbers right-aligned. -->
<div>
	<div class={cn(flushHeader, 'flex items-baseline justify-between gap-3')}>
		<h2 class={flushHeaderTitle}>{t('Weapons')}</h2>
		<p class="text-secondary-500 text-xs">{t('{count} weapons', { count: filtered.length })}</p>
	</div>
	{#if filtered.length}
		<div class="overflow-x-auto">
			<table class="w-full min-w-[40rem] border-collapse text-sm">
				<thead>
					<tr class={tableHeadRow}>
						<th class="px-4 py-2 text-left font-semibold">{t('Weapon')}</th>
						<th class="px-4 py-2 text-right font-semibold">{t('Damage')}</th>
						<th class="px-4 py-2 text-right font-semibold">{t('Range')}</th>
						<th class="w-56 px-4 py-2 text-left font-semibold">{t('Accuracy')}</th>
						<th class="px-4 py-2 text-right font-semibold">{t('Used by')}</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as weapon (weapon.slug)}
						<tr
							class="border-secondary-800 hover:bg-secondary-950/60 border-b transition-colors last:border-b-0"
						>
							<td class="px-4 py-2">
								<a
									href={host.href(`/wiki/weapons/${weapon.slug}`)}
									class={cn(
										interactive,
										'flex min-w-0 items-center gap-3 text-white hover:underline'
									)}
								>
									<DocsIcon icon={weapon.icon} name={weapon.name} class="size-8" />
									<span class="truncate">{weapon.name}</span>
								</a>
							</td>
							<td class="px-4 py-2 text-right font-bold text-white tabular-nums">
								{between(weapon.damage?.min, weapon.damage?.max) ?? '-'}
							</td>
							<td class="text-secondary-300 px-4 py-2 text-right tabular-nums">
								{weapon.range?.max ? formatNumber(weapon.range.max) : '-'}
							</td>
							<td class="px-4 py-2">
								{#if weapon.accuracy}
									<div class="grid grid-cols-3 gap-2">
										{#each RANGES as range (range)}
											{@const value = weapon.accuracy[range] ?? 0}
											<div {@attach tooltip(t(RANGE_LABELS[range]))}>
												<p class="text-xs font-semibold text-white tabular-nums">
													{Math.round(value * 100)}%
												</p>
												<div class="bg-secondary-800 mt-1 h-1 overflow-hidden rounded-full">
													<div
														class={cn('h-full rounded-full', chanceTone(value))}
														style:width="{Math.min(value, 1) * 100}%"
													></div>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<span class="text-secondary-500">-</span>
								{/if}
							</td>
							<td class="text-secondary-300 px-4 py-2 text-right tabular-nums">{weapon.usedBy}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="text-secondary-400 px-4 py-6 text-sm">{t('Nothing matches your search.')}</p>
	{/if}
</div>
