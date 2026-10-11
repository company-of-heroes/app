<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		factionIcon,
		flushHeaderTitle,
		interactive,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { ToggleGroup } from '../ui/toggle-group';
	import type { Ribbon } from './ribbon';

	type Props = {
		/** Ribbon key (e.g. `ribbon-042`), or null to use the uploaded image. */
		value: string | null;
		/** Ribbons other rewards already use; shown, but not selectable. */
		used?: string[];
		disabled?: boolean;
	};

	let { value = $bindable(), used = [], disabled = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const ribbons = host.resolve.ribbons();
	/** Global ribbons (no faction) first, then one group per faction. */
	const GROUPS: (number | null)[] = [null, 0, 1, 2, 3];
	const groupValue = (raceId: number | null) => (raceId === null ? 'global' : String(raceId));
	const groupLabel = (raceId: number | null) =>
		raceId === null ? t('Global') : t(getRaceLabel(raceId));

	let open = $state(false);
	let filter = $state('all');

	const taken = $derived(new Set(used));
	const selected = $derived(ribbons.find((ribbon) => ribbon.key === value) ?? null);
	/** Per faction: single ribbons, then each ranked series by level. */
	const allGroups = GROUPS.map((raceId) => {
		const own = ribbons.filter((ribbon) => ribbon.raceId === raceId);
		const series = [...new Set(own.flatMap((ribbon) => (ribbon.series ? [ribbon.series] : [])))];
		return {
			raceId,
			single: own.filter((ribbon) => !ribbon.series),
			ranked: series.map((key) => ({
				key,
				ribbons: own
					.filter((ribbon) => ribbon.series === key)
					.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
			}))
		};
	});
	/** The toggle narrows the groups to one faction. */
	const groups = $derived(
		allGroups.filter((group) => filter === 'all' || groupValue(group.raceId) === filter)
	);
	const filterItems = $derived([
		{ value: 'all', label: t('All') },
		...GROUPS.map((raceId) => ({ value: groupValue(raceId), label: groupLabel(raceId) }))
	]);

	function choose(key: string) {
		value = key;
		open = false;
	}
</script>

<div class="flex items-center gap-4">
	<div
		class="border-secondary-800 bg-secondary-950 flex h-12 w-28 shrink-0 items-center justify-center rounded-md border"
	>
		{#if selected}
			<img src={selected.url} alt={selected.title} class="h-6 w-21 rounded-xs" />
		{:else}
			<span class="text-secondary-500 px-2 text-center text-xs">{t('No ribbon')}</span>
		{/if}
	</div>
	<div class="flex flex-col items-start gap-2">
		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="secondary"
				size="sm"
				disabled={disabled || ribbons.length === 0}
				onclick={() => (open = true)}
			>
				{selected ? t('Change ribbon') : t('Choose ribbon')}
			</Button>
			{#if selected}
				<Button type="button" variant="ghost" size="sm" {disabled} onclick={() => (value = null)}>
					{t('Use image')}
				</Button>
			{/if}
		</div>
		{#if selected}
			<p class="text-secondary-300 text-sm">{selected.title}</p>
		{/if}
	</div>
</div>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 flex max-h-[calc(100vh-6rem)] w-[720px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{t('Reward ribbon')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{t('Shown instead of the image, under the bio of every player who unlocks it.')}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={t('Close')}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</Dialog.Title>
			<div class="border-secondary-800 border-b px-4 py-2">
				<ToggleGroup bind:value={filter} items={filterItems} aria-label={t('Faction')} />
			</div>
			<div class="overflow-y-auto">
				{#each groups as group (groupValue(group.raceId))}
					<section class="border-secondary-800 border-b last:border-b-0">
						<h3
							class="border-secondary-800 bg-secondary-950 text-secondary-300 sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase"
						>
							{#if group.raceId === null}
								<span
									class={cn(
										factionIcon,
										'bg-secondary-800 text-secondary-300 inline-flex items-center justify-center'
									)}
								>
									<GlobeIcon size={14} />
								</span>
							{:else}
								<img
									src={host.resolve.factionFlagByRace(group.raceId)}
									alt=""
									class={factionIcon}
								/>
							{/if}
							{groupLabel(group.raceId)}
						</h3>
						{@render grid(group.single)}
						{#if group.ranked.length > 0}
							<p
								class="border-secondary-800 text-secondary-400 border-t px-4 pt-3 text-xs font-semibold tracking-wide uppercase"
							>
								{t('Ranked (level 1 to 5)')}
							</p>
							<div class="flex flex-col gap-1 p-3">
								{#each group.ranked as series (series.key)}
									{@render grid(series.ribbons, 'grid-cols-5')}
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

{#snippet grid(list: Ribbon[], layout = 'grid-cols-3 p-3 sm:grid-cols-4 md:grid-cols-5')}
	<ul class={cn('grid gap-1', layout)}>
		{#each list as ribbon (ribbon.key)}
			{@const isTaken = taken.has(ribbon.key) && ribbon.key !== value}
			<li>
				<button
					type="button"
					title={isTaken ? `${ribbon.title} (${t('Already used')})` : ribbon.title}
					aria-label={ribbon.title}
					aria-pressed={ribbon.key === value}
					disabled={isTaken}
					onclick={() => choose(ribbon.key)}
					class={cn(
						interactive,
						'flex w-full flex-col items-center gap-1 rounded-md border p-2 transition-colors',
						isTaken ? '' : 'hover:bg-secondary-800/60',
						ribbon.key === value ? 'border-warning bg-warning/10' : 'border-transparent'
					)}
				>
					<img
						src={ribbon.url}
						alt=""
						loading="lazy"
						class={cn('aspect-7/2 w-full max-w-28 rounded-xs', isTaken && 'opacity-30 grayscale')}
					/>
					{#if isTaken}
						<span class="text-secondary-500 text-xs">{t('Already used')}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/snippet}
