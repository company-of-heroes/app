<script lang="ts">
	import { Popover } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import { interactive, popoverSection, tooltipPanel } from '../variants';
	import { docsPath } from '../docs/format';
	import { loadReplayStats, type ReplayStats } from '@company-of-heroes/game-data/replay';
	import ArrowUpRightIcon from 'phosphor-svelte/lib/ArrowUpRightIcon';
	import { getRaceLabel } from '../format/player-format';
	import { blueprintCost } from '../replay/replay-costs';
	import { actionIconKey } from '../replay/action-icons';
	import { doctrineBannerFile } from '../replay/replay-stats';
	import { loadActionInfo, lookupActionInfo } from '../replay/replay-action-info';
	import BlueprintCost from '../replay/blueprint-cost.svelte';
	import BlueprintStats from '../replay/blueprint-stats.svelte';
	import DoctrineTree from './doctrine-tree.svelte';
	import type { InfoEntry, InfoPopover } from './info-popover.svelte';

	type Props = {
		popover: InfoPopover;
	};

	let { popover }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const TYPE_LABELS = { unit: 'Unit', upgrade: 'Upgrade', doctrine: 'Doctrine' } as const;

	let stats = $state<ReplayStats>();
	$effect(() => {
		if (popover.shown && !stats) {
			void loadReplayStats().then((table) => (stats = table));
		}
	});

	/** Wiki page of the unit or doctrine, on hosts that have the wiki. */
	function wikiPath(entry: InfoEntry): string | null {
		if (!host.api.docs || !stats) {
			return null;
		}

		const slug =
			entry.kind === 'doctrine'
				? stats.commanders[entry.doctrine]
				: entry.kind === 'unit'
					? stats.sbps[entry.id]?.slug
					: undefined;
		return slug ? docsPath({ kind: entry.kind === 'doctrine' ? 'commander' : 'unit', slug }) : null;
	}

	let infoTable = $state<Awaited<ReturnType<typeof loadActionInfo>>>();
	$effect(() => {
		if (popover.shown && !infoTable) {
			void loadActionInfo().then((table) => (infoTable = table));
		}
	});

	function icon(type: string, objectID: number): string | undefined {
		const key = actionIconKey({ objectID, command: { type } });
		return key ? host.resolve.actionIcon(key) : undefined;
	}

	function headerIcon(entry: InfoEntry): string | undefined {
		if (entry.kind === 'doctrine') {
			return icon('DOCTRINAL', entry.doctrine);
		}

		return icon(entry.kind === 'unit' ? 'UNIT' : 'UPGRADE', entry.id);
	}

	function bannerUrl(entry: InfoEntry & { kind: 'doctrine' }): string | null {
		const file = doctrineBannerFile({
			doctrine: entry.doctrine,
			faction: entry.raceId === 0 || entry.raceId === 2 ? 'allies' : 'axis'
		});
		return file ? host.resolve.doctrineBanner(file) : null;
	}

	const list = (entry: InfoEntry) => (entry.kind === 'unit' ? 'sbps' : 'upgrade');
</script>

{#snippet iconImage(src: string | undefined, size: string)}
	{#if src}
		<img {src} alt="" class={cn(size, 'shrink-0 rounded-sm')} />
	{:else}
		<span class={cn(size, 'bg-secondary-800 shrink-0 rounded-sm')}></span>
	{/if}
{/snippet}

<Popover.Root
	open={popover.shown != null}
	onOpenChange={(open) => {
		if (!open) {
			popover.close();
		}
	}}
>
	<Popover.Portal>
		<Popover.Content
			customAnchor={popover.shown?.anchor ?? null}
			side="top"
			sideOffset={8}
			collisionPadding={8}
			trapFocus={false}
			preventScroll={false}
			interactOutsideBehavior={popover.pinned ? 'close' : 'ignore'}
			onOpenAutoFocus={(event) => event.preventDefault()}
			onCloseAutoFocus={(event) => event.preventDefault()}
			class={cn(
				tooltipPanel,
				'z-50 max-w-[calc(100vw-1rem)] overflow-hidden p-0',
				popover.shown?.entry.kind === 'doctrine' ? 'w-80' : 'w-72',
				popover.pinned ? 'ring-primary/40 ring-1' : 'pointer-events-none'
			)}
		>
			{#if popover.shown}
				{@const entry = popover.shown.entry}
				{@const path = wikiPath(entry)}
				{@const info =
					entry.kind === 'doctrine'
						? null
						: lookupActionInfo(infoTable, { list: list(entry), objectID: entry.id })}
				{@const cost =
					entry.kind === 'doctrine'
						? null
						: blueprintCost({ list: list(entry), objectID: entry.id })}
				{@const banner = entry.kind === 'doctrine' ? bannerUrl(entry) : null}
				<div class="relative isolate overflow-hidden p-3">
					<!-- The doctrine's in-game banner behind the header, faded so the text stays readable. -->
					{#if banner}
						<img
							src={banner}
							alt=""
							aria-hidden="true"
							class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-left opacity-35"
						/>
						<div
							class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-gray-950/30 via-gray-950/60 to-gray-950/90"
						></div>
					{/if}
					<div class="flex items-center gap-3">
						{@render iconImage(headerIcon(entry), 'size-10')}
						<div class="min-w-0 flex-1">
							<p class="truncate leading-tight font-semibold text-white">
								{#if path}
									<!-- Hosts with the wiki link the unit or doctrine to its page. -->
									<a
										href={host.href(path)}
										class={cn(
											interactive,
											'hover:text-primary inline-flex items-center gap-1 hover:underline'
										)}
									>
										{info?.name ?? entry.name}
										<ArrowUpRightIcon class="text-secondary-400 size-3.5 shrink-0" weight="bold" />
									</a>
								{:else}
									{info?.name ?? entry.name}
								{/if}
							</p>
							<p class="text-secondary-400 mt-1 text-xs">
								{t(TYPE_LABELS[entry.kind])}
								<span class="text-secondary-500">·</span>
								{t(getRaceLabel(entry.raceId))}
							</p>
						</div>
					</div>
					{#if entry.kind !== 'doctrine'}
						<BlueprintCost list={list(entry)} id={entry.id} {cost} class="mt-3" />
					{/if}
				</div>
				{#if entry.kind === 'doctrine'}
					<DoctrineTree
						doctrine={entry.doctrine}
						{infoTable}
						class="border-secondary-800 border-t"
					/>
				{:else}
					<BlueprintStats list={list(entry)} id={entry.id} />
					{#if info?.help || info?.extra}
						<div class={cn(popoverSection, 'text-xs')}>
							{#if info.help}
								<p class="text-secondary-300 font-normal">{info.help}</p>
							{/if}
							{#if info.extra}
								<p class="text-primary mt-1.5 font-semibold">{info.extra}</p>
							{/if}
						</div>
					{/if}
				{/if}
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
