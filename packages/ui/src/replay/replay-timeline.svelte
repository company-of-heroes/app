<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';
	import { onMount, tick } from 'svelte';
	import ArrowsInLineHorizontalIcon from 'phosphor-svelte/lib/ArrowsInLineHorizontal';
	import MagnifyingGlassMinusIcon from 'phosphor-svelte/lib/MagnifyingGlassMinus';
	import MagnifyingGlassPlusIcon from 'phosphor-svelte/lib/MagnifyingGlassPlus';
	import ClockIcon from 'phosphor-svelte/lib/Clock';
	import InfoIcon from 'phosphor-svelte/lib/Info';
	import { tooltip } from '@company-of-heroes/ui/tooltip';
	import { Popover } from 'bits-ui';
	import { tryUseHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { interactive, tooltipPanel } from '../variants';
	import TimelineRowIcon from './replay-timeline-row-icon.svelte';
	import { actionIconKey } from './action-icons';
	import {
		actionCost,
		blueprintRef,
		RESOURCE_COLOURS,
		type ActionCost,
		type BlueprintRef
	} from './replay-costs';
	import { loadActionInfo, lookupActionInfo, type ActionInfo } from './replay-action-info';
	import {
		doctrineArt,
		factionArt,
		formatTimelineClock,
		TIMELINE_ROWS,
		timelineRow,
		timelineTicks,
		VETERANCY_NAMES,
		wehrmachtUnitCategory,
		wehrmachtVeterancy,
		type TimelineRowKey,
		type VeterancyStep
	} from './replay-timeline';
	import { raceFromReplayFaction, timelineActionsByPlayer } from './replay-stats';
	import { isCancelAction, type ReplayAction, type ReplayData, type ReplayPlayer } from './types';

	type Props = {
		replay: ReplayData;
		playerId: number | null;
	};

	type TimelineItem = {
		key: string;
		second: number;
		timestamp: string;
		/** Short name (e.g. "Riflemen"); `label` is the description used as image alt text. */
		name: string;
		label: string;
		/** Command type (UNIT, UPGRADE, CANCEL_QUEUE, …) for the popover. */
		type: string;
		cost: (ActionCost & { refunded?: boolean }) | null;
		/** Game blueprint (for the in-game description). */
		ref: BlueprintRef | null;
		vetSteps: VeterancyStep[];
		initials: string;
		src: string | undefined;
		cancelled: boolean;
		/** Wehrmacht Kampfkraft level (0–3) the unit's category reached. */
		veterancy: number;
	};

	let { replay, playerId }: Props = $props();
	const host = tryUseHost();
	const { t } = useI18n();

	const ROW_BORDERS: Record<TimelineRowKey, string> = {
		structures: 'border-green-400/80',
		units: 'border-sky-400/80',
		defenses: 'border-lime-300/70',
		upgrades: 'border-orange-400/80',
		abilities: 'border-violet-400/80',
		doctrine: 'border-yellow-400 border-2'
	};

	/** Width of the sticky label column (8.5rem) and the track's side inset (inset-x-5). */
	const LABEL_PX = 136;
	const TRACK_INSET_PX = 20;
	const MIN_ZOOM = 1;
	const MAX_ZOOM = 40;

	let scroller = $state<HTMLDivElement>();
	let scrollerWidth = $state(0);
	/** 1 = whole match fits the visible width. */
	let zoom = $state(1);
	let drag: { x: number; scrollLeft: number; moved: boolean } | null = null;

	const duration = $derived(Math.max(1, replay.duration));
	const availablePx = $derived(Math.max(240, scrollerWidth - LABEL_PX));
	const trackPx = $derived(availablePx * zoom);
	const pxPerSecond = $derived((trackPx - TRACK_INSET_PX * 2) / duration);
	const ticks = $derived(timelineTicks(duration, pxPerSecond));
	const resolveIcon = (key: string | null | undefined) =>
		key ? host?.resolve.actionIcon(key) : undefined;
	const cancelIcon = resolveIcon('commands_icon_command_cancel');
	const veterancyIcons = [1, 2, 3].map((level) => resolveIcon(`veterancy_lv${level}`));

	function initials(name: string): string {
		return name
			.split(/[\s()/-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join('');
	}

	function toItem(
		action: ReplayAction,
		index: number,
		vetSteps: VeterancyStep[] = []
	): TimelineItem {
		const name = action.command?.name || action.command?.description || '';
		return {
			key: `${action.tick}-${action.commandID ?? 0}-${action.objectID ?? 0}-${index}`,
			second: action.tick / 8,
			timestamp: action.timestamp,
			name,
			label: action.command?.description || name,
			type: action.command?.type ?? '',
			cost: actionCost(action),
			ref: blueprintRef(action),
			vetSteps,
			initials: initials(name),
			src: resolveIcon(actionIconKey(action)),
			cancelled: isCancelAction(action),
			veterancy: vetSteps.at(-1)?.level ?? 0
		};
	}

	function buildRows(actions: ReplayAction[], isWehrmacht: boolean) {
		const veterancy = isWehrmacht ? wehrmachtVeterancy(actions) : undefined;
		const byRow = new Map<TimelineRowKey, TimelineItem[]>(
			TIMELINE_ROWS.map((row) => [row.key, []])
		);
		actions.forEach((action, index) => {
			const row = timelineRow(action);
			if (row) {
				const category = veterancy && wehrmachtUnitCategory(action);
				byRow.get(row)!.push(toItem(action, index, category ? veterancy.get(category) : undefined));
			}
		});
		return TIMELINE_ROWS.map((row) => ({ ...row, items: byRow.get(row.key)! }));
	}

	/** Popover lookup: icons carry `data-entry={item.key}`. */
	function indexEntries(rows: ReturnType<typeof buildRows>) {
		const entries = new Map<string, { item: TimelineItem; row: TimelineRowKey }>();
		for (const row of rows) {
			for (const item of row.items) {
				entries.set(item.key, { item, row: row.key });
			}
		}
		return entries;
	}

	function buildPlayer(player: ReplayPlayer, actions: ReplayAction[]) {
		const race = raceFromReplayFaction(player.faction);
		const rows = buildRows(actions, player.faction === 'axis');
		return {
			id: player.id,
			race,
			art: doctrineArt(player),
			faction: factionArt(race),
			rows,
			entries: indexEntries(rows)
		};
	}

	/** Every player's timeline, built once per replay so switching players is a lookup. */
	const players = $derived.by(() => {
		const byPlayer = timelineActionsByPlayer(replay);
		return replay.players
			.filter((player) => player.id != null)
			.map((player) => buildPlayer(player, byPlayer.get(player.id!) ?? []));
	});
	const active = $derived(players.find((item) => item.id === playerId) ?? players[0]);

	/**
	 * Players whose timeline DOM is mounted. The active one renders immediately; the others are
	 * mounted one by one in idle time (and stay mounted, hidden) so switching is instant and their
	 * icons are already loaded.
	 */
	let mountedIds = $state<number[]>([]);
	const isMounted = (id: number | null) =>
		id != null && (id === active?.id || mountedIds.includes(id));

	onMount(() => {
		// requestIdleCallback is missing in older WebKit (Safari, Tauri on macOS).
		const hasIdle = typeof window.requestIdleCallback === 'function';
		const idle = (callback: () => void): number =>
			hasIdle
				? window.requestIdleCallback(callback, { timeout: 1000 })
				: Number(setTimeout(callback, 50));
		const cancelIdle = (handle: number) =>
			hasIdle ? window.cancelIdleCallback(handle) : clearTimeout(handle);
		let handle = 0;
		const mountNext = () => {
			const next = players.find((item) => item.id != null && !mountedIds.includes(item.id));
			if (!next || next.id == null) {
				return;
			}

			mountedIds = [...mountedIds, next.id];
			handle = idle(mountNext);
		};

		handle = idle(mountNext);
		// Warm the background art for every faction/doctrine in the match.
		for (const item of players) {
			for (const key of [
				item.faction.map,
				item.faction.character,
				item.art?.badge,
				item.art?.stripes
			]) {
				const src = resolveIcon(key);
				if (src) {
					new Image().src = src;
				}
			}
		}

		return () => cancelIdle(handle);
	});

	/**
	 * One shared popover for every icon (per-icon instances were the main render cost). It opens
	 * after a short hover delay and anchors to the hovered icon via `customAnchor`.
	 */
	let hovered = $state<{ item: TimelineItem; row: TimelineRowKey; anchor: HTMLElement } | null>(
		null
	);
	let hoverTimer: ReturnType<typeof setTimeout> | undefined;

	function clearHover() {
		clearTimeout(hoverTimer);
		hovered = null;
	}

	/** Clicking an icon pins its popover (interactive, with the in-game description behind ⓘ). */
	let pinned = $state<{ item: TimelineItem; row: TimelineRowKey; anchor: HTMLElement } | null>(
		null
	);
	const shown = $derived(pinned ?? hovered);
	let infoTable = $state<Awaited<ReturnType<typeof loadActionInfo>>>();
	const shownInfo = $derived<ActionInfo | null>(
		shown ? lookupActionInfo(infoTable, shown.item.ref) : null
	);
	/** A drag that ends on an icon must not pin it. */
	let suppressClick = false;

	function onIconClick(event: MouseEvent) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}

		const target = (event.target as Element).closest<HTMLElement>('[data-entry]');
		const entry = target?.dataset.entry ? active?.entries.get(target.dataset.entry) : undefined;
		if (!target || !entry) {
			return;
		}

		pinned = pinned?.anchor === target ? null : { ...entry, anchor: target };
		void loadActionInfo().then((table) => (infoTable = table));
	}

	function escapeHtml(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;');
	}

	const infoTooltip = (info: ActionInfo) =>
		[
			info.help && `<span class="block leading-snug">${escapeHtml(info.help)}</span>`,
			info.extra &&
				`<span class="mt-1.5 block text-xs font-semibold text-primary">${escapeHtml(info.extra)}</span>`
		]
			.filter(Boolean)
			.join('');

	function onHover(event: PointerEvent) {
		const target = (event.target as Element).closest<HTMLElement>('[data-entry]');
		const entry = target?.dataset.entry ? active?.entries.get(target.dataset.entry) : undefined;
		if (!target || !entry || drag?.moved) {
			clearHover();
			return;
		}

		if (hovered?.anchor === target) {
			return;
		}

		clearTimeout(hoverTimer);
		// Moving between icons swaps the popover at once; the first hover waits a moment.
		hoverTimer = setTimeout(() => (hovered = { ...entry, anchor: target }), hovered ? 0 : 120);
	}

	const TYPE_LABELS: Record<string, string> = {
		UNIT: 'Unit',
		BUILDING: 'Building',
		UPGRADE: 'Upgrade',
		UNIT_COMMAND: 'Unit command',
		SPECIAL_ABILITY: 'Special ability',
		DOCTRINAL: 'Doctrine',
		CANCEL_QUEUE: 'Cancelled order',
		CANCEL_CONSTRUCTION: 'Cancelled building'
	};
	const RESOURCE_LABELS = {
		manpower: 'Manpower',
		fuel: 'Fuel',
		munition: 'Munitions',
		popcap: 'Population'
	} as const;
	const COST_RESOURCES = ['manpower', 'fuel', 'munition', 'popcap'] as const;
	const resourceIcons = Object.fromEntries(
		COST_RESOURCES.map((resource) => [resource, resolveIcon(`resource_${resource}`)])
	);
	const formatAmount = (value: number) => Math.round(value).toLocaleString();

	/** Icon width (size-12) plus the stack offset and badge: closer icons would overlap. */
	const ICON_SLOT_PX = 60;
	/** Maximum fan-out of a stack's back cards, however many actions it holds. */
	const STACK_SPREAD_PX = 12;
	/** Vertical space per lane: veterancy stripes, icon, gap and timestamp. */
	const LANE_PX = 76;
	/** Icons that would overlap go to the next lane; past this many lanes they are stacked. */
	const MAX_LANES = 3;

	type Cluster = { key: string; second: number; lane: number; items: TimelineItem[] };

	/**
	 * Places icons at the current zoom: each icon takes the first lane where it does not overlap
	 * the previous one; when all lanes are taken it joins the most recent icon as a stack.
	 * Zooming in spreads icons back into a single lane.
	 */
	function layoutRow(items: TimelineItem[], pixelsPerSecond: number) {
		const clusters: Cluster[] = [];
		const laneEnds: number[] = [];
		const laneLast: Cluster[] = [];
		for (const item of items) {
			const x = item.second * pixelsPerSecond;
			let lane = laneEnds.findIndex((end) => x - end >= ICON_SLOT_PX);
			if (lane === -1 && laneEnds.length < MAX_LANES) {
				lane = laneEnds.length;
			}

			if (lane === -1) {
				const nearest = laneLast.reduce((best, cluster) =>
					cluster.second > best.second ? cluster : best
				);
				nearest.items.push(item);
				continue;
			}

			const cluster = { key: item.key, second: item.second, lane, items: [item] };
			clusters.push(cluster);
			laneEnds[lane] = x;
			laneLast[lane] = cluster;
		}
		return { clusters, lanes: Math.max(1, laneEnds.length) };
	}

	const position = (second: number) => `${(Math.min(second, duration) / duration) * 100}%`;

	/** Zoom while keeping the time under `anchorX` (px from the scroller's left edge) in place. */
	async function setZoom(next: number, anchorX = (scroller?.clientWidth ?? 0) / 2) {
		const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
		if (!scroller || clamped === zoom) {
			return;
		}

		const trackX = Math.max(0, scroller.scrollLeft + anchorX - LABEL_PX);
		const ratio = trackX / trackPx;
		zoom = clamped;
		await tick();
		scroller.scrollLeft = ratio * trackPx - anchorX + LABEL_PX;
	}

	function onWheel(event: WheelEvent) {
		// Ctrl/⌘ + wheel, or a trackpad pinch (reported as ctrl + wheel), zooms; plain wheel scrolls the page.
		if (!scroller || !(event.ctrlKey || event.metaKey)) {
			return;
		}

		event.preventDefault();
		const rect = scroller.getBoundingClientRect();
		void setZoom(zoom * Math.exp(-event.deltaY * 0.0025), event.clientX - rect.left);
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0 || !scroller || zoom === MIN_ZOOM) {
			return;
		}

		// Stop the browser from starting a text selection or a native image drag.
		event.preventDefault();
		drag = { x: event.clientX, scrollLeft: scroller.scrollLeft, moved: false };
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag || !scroller) {
			return;
		}

		const dx = event.clientX - drag.x;
		if (!drag.moved && Math.abs(dx) < 4) {
			return;
		}

		if (!drag.moved) {
			drag.moved = true;
			scroller.setPointerCapture(event.pointerId);
		}

		scroller.scrollLeft = drag.scrollLeft - dx;
	}

	function onPointerUp(event: PointerEvent) {
		suppressClick = !!drag?.moved;
		if (drag?.moved && scroller?.hasPointerCapture(event.pointerId)) {
			scroller.releasePointerCapture(event.pointerId);
		}

		drag = null;
	}
</script>

{#snippet iconBox(entry: TimelineItem, rowKey: TimelineRowKey, extra: string)}
	<div class={cn('relative', extra)}>
		{#if entry.veterancy > 0 && veterancyIcons[entry.veterancy - 1]}
			<!-- In-game veterancy stripes (1 Veteran, 2 Crack, 3 Elite) above the icon. -->
			<img
				src={veterancyIcons[entry.veterancy - 1]}
				alt={t(VETERANCY_NAMES[entry.veterancy - 1])}
				draggable="false"
				class="absolute bottom-full left-1/2 mb-0.5 h-1 w-auto -translate-x-1/2 drop-shadow-[0_0_1px_rgba(0,0,0,1)]"
			/>
		{/if}
		<div
			class={cn(
				'relative size-12 overflow-hidden border bg-black/70 shadow-md shadow-black/60',
				rowKey === 'doctrine' ? 'rounded-full' : 'rounded-[3px]',
				entry.cancelled ? 'border-red-500/80' : ROW_BORDERS[rowKey]
			)}
		>
			{#if entry.src}
				<img
					src={entry.src}
					alt={entry.label}
					decoding="async"
					draggable="false"
					class={cn('size-full object-cover', entry.cancelled && 'opacity-55 grayscale')}
				/>
			{:else}
				<span
					class="text-secondary-300 flex size-full items-center justify-center text-sm font-bold"
				>
					{entry.initials}
				</span>
			{/if}
			{#if entry.cancelled && cancelIcon}
				<img
					src={cancelIcon}
					alt=""
					draggable="false"
					class="absolute right-0.5 bottom-0.5 size-5"
				/>
			{/if}
		</div>
	</div>
{/snippet}

<svelte:window onscroll={clearHover} />

<section class="border-secondary-800 relative overflow-hidden border-b bg-[#2a251c]">
	{#if active}
		{@const art = active.art}
		{@const faction = active.faction}
		<!-- Filters and fades are baked into the art files; only opacity is applied here. -->
		<div class="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
			{#if resolveIcon(faction.map)}
				<img
					src={resolveIcon(faction.map)}
					alt=""
					class="absolute inset-0 size-full object-cover"
				/>
			{/if}
			{#if art && resolveIcon(art.stripes)}
				<img
					src={resolveIcon(art.stripes)}
					alt=""
					class="absolute inset-y-0 left-[47%] h-full w-[15%] -translate-x-1/2 object-fill opacity-35"
				/>
			{/if}
			{#if art && resolveIcon(art.badge)}
				<img
					src={resolveIcon(art.badge)}
					alt=""
					class="absolute top-1/2 left-[47%] h-[72%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-55"
				/>
			{/if}
			{#if resolveIcon(faction.character)}
				<img
					src={resolveIcon(faction.character)}
					alt=""
					class="absolute right-0 bottom-0 h-[115%] object-contain object-right-bottom opacity-70"
				/>
			{/if}
			{#if art}
				<p
					class="absolute bottom-[6%] left-[10rem] max-w-[45%] font-[Impact,Haettenschweiler,'Arial_Narrow_Bold','Franklin_Gothic_Heavy',sans-serif] text-5xl leading-[0.92] font-normal tracking-[0.04em] text-[#efe3c4] uppercase opacity-[.16] md:text-7xl"
				>
					{art.title}
				</p>
			{/if}
			<div
				class="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_35%,rgba(0,0,0,.65)_100%)]"
			></div>
		</div>
	{/if}

	<div
		class="relative z-30 flex items-center gap-1 border-b border-white/10 bg-gray-950 px-4 py-1.5"
	>
		<p class="mr-auto hidden text-xs text-[#d8cdb2]/70 sm:block">
			{t('Ctrl + scroll to zoom, drag to pan')}
		</p>
		<span class="w-12 text-right text-xs text-[#d8cdb2]/80 tabular-nums">
			{Math.round(zoom * 100)}%
		</span>
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label={t('Zoom out')}
			disabled={zoom <= MIN_ZOOM}
			onclick={() => setZoom(zoom / 1.5)}
		>
			<MagnifyingGlassMinusIcon class="size-4" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label={t('Zoom in')}
			disabled={zoom >= MAX_ZOOM}
			onclick={() => setZoom(zoom * 1.5)}
		>
			<MagnifyingGlassPlusIcon class="size-4" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label={t('Fit to width')}
			disabled={zoom <= MIN_ZOOM}
			onclick={() => setZoom(MIN_ZOOM)}
		>
			<ArrowsInLineHorizontalIcon class="size-4" />
		</Button>
	</div>

	<!-- Pinning a popover by click is a pointer shortcut to detail that the action totals also show;
		making every icon a tab stop would bury keyboard navigation in hundreds of stops. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={scroller}
		bind:clientWidth={scrollerWidth}
		class={cn(
			// select-none: dragging to pan must not select timestamps or labels.
			'relative overflow-x-auto overscroll-x-contain select-none',
			zoom > MIN_ZOOM && 'cursor-grab active:cursor-grabbing'
		)}
		role="region"
		aria-label={t('Replay timeline')}
		onwheel={onWheel}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onpointerover={onHover}
		onclick={onIconClick}
		onpointerleave={clearHover}
		onscroll={clearHover}
	>
		{#each players as item (item.id)}
			{#if isMounted(item.id)}
				<div
					class={cn('grid-cols-[8.5rem_minmax(0,1fr)]', item.id === active?.id ? 'grid' : 'hidden')}
					style:width="{LABEL_PX + trackPx}px"
				>
					{#each item.rows as row (row.key)}
						<div
							class="sticky left-0 z-20 flex items-start gap-2.5 border-b border-white/10 bg-gradient-to-r from-black/45 to-black/10 px-4 pt-5"
						>
							<TimelineRowIcon
								row={row.key}
								icon={row.key === 'doctrine' ? item.art?.medal : null}
								race={item.race}
							/>
							<span
								class="text-[11px] leading-10 font-bold tracking-[0.18em] text-[#ece4cf] uppercase [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
							>
								{t(row.label)}
							</span>
						</div>
						{@const layout = layoutRow(row.items, pxPerSecond)}
						<div
							class="relative border-b border-white/10"
							style:height="{24 + layout.lanes * LANE_PX + 28}px"
						>
							<div class="absolute inset-x-5 top-4" style:height="{layout.lanes * LANE_PX}px">
								{#each layout.clusters as cluster (cluster.key)}
									{@const first = cluster.items[0]}
									{@const count = cluster.items.length}
									{@const shape = row.key === 'doctrine' ? 'rounded-full' : 'rounded-[3px]'}
									<div
										class="group absolute flex flex-col items-center hover:z-30"
										style:left={position(cluster.second)}
										style:top="{cluster.lane * LANE_PX}px"
										data-entry={count === 1 ? first.key : undefined}
									>
										{#if count === 1}
											{@render iconBox(first, row.key, 'transition-transform hover:scale-125')}
										{:else}
											<div class="relative">
												<!-- One card behind the top icon per extra action; the fan stays within STACK_SPREAD_PX. -->
												{#each cluster.items.slice(1).reverse() as entry, index (entry.key)}
													{@const offset =
														(count - 1 - index) * Math.min(3, STACK_SPREAD_PX / (count - 1))}
													<div
														class={cn(
															'absolute inset-0 border bg-black/70',
															shape,
															entry.cancelled ? 'border-red-500/80' : ROW_BORDERS[row.key]
														)}
														style:translate="{offset}px {-offset}px"
													></div>
												{/each}
												{@render iconBox(
													{ ...first, cancelled: cluster.items.some((entry) => entry.cancelled) },
													row.key,
													''
												)}
												<span
													class="absolute -top-2.5 -right-2.5 z-10 min-w-5 rounded-full bg-[#d9b44a] px-1 text-center text-[10px] leading-5 font-bold text-black shadow"
												>
													+{count - 1}
												</span>
											</div>
											<!-- Hovering a stack fans it out into a strip with every icon. -->
											<div
												class={cn(
													'absolute -top-1 hidden gap-1 rounded-md bg-black/85 p-1 shadow-xl ring-1 ring-white/15 group-hover:flex',
													cluster.second / duration > 0.7 ? 'right-0' : 'left-0'
												)}
											>
												{#each cluster.items as entry (entry.key)}
													<div class="flex flex-col items-center" data-entry={entry.key}>
														{@render iconBox(
															entry,
															row.key,
															'transition-transform hover:scale-110'
														)}
														<span
															class="mt-1 text-[10px] leading-none text-[#d8cdb2]/80 tabular-nums"
														>
															{entry.timestamp}
														</span>
													</div>
												{/each}
											</div>
										{/if}
										<span
											class="mt-1 text-[10px] leading-none text-[#d8cdb2]/75 tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
										>
											{first.timestamp}
										</span>
									</div>
								{/each}
							</div>
							<!-- Dark band behind the axis so ticks stay readable on bright background art. -->
							<div
								class="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-black/60 to-transparent"
							></div>
							<div class="absolute inset-x-5 bottom-1.5 h-6">
								<div class="absolute inset-x-0 top-0 h-px bg-[#e5dcc4]/55"></div>
								{#each ticks as tickSecond, index (tickSecond)}
									{@const isLast = index === ticks.length - 1}
									{@const isMajor = isLast || tickSecond % 1800 === 0}
									{@const crowdsEnd = !isLast && (duration - tickSecond) * pxPerSecond < 48}
									<div
										class={cn(
											'absolute top-0 flex flex-col',
											index === 0 ? 'items-start' : 'items-center',
											isLast && 'items-end'
										)}
										style:left={position(tickSecond)}
										style:translate={index === 0 ? '0' : isLast ? '-100%' : '-50%'}
									>
										<span
											class={cn(
												'w-px',
												isMajor && tickSecond > 0 ? 'h-2.5 bg-white/90' : 'h-1.5 bg-[#e5dcc4]/75'
											)}
										></span>
										{#if !crowdsEnd}
											<span
												class={cn(
													'mt-1 text-[11px] leading-none tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]',
													isMajor && tickSecond > 0
														? 'font-bold text-white'
														: 'font-medium text-[#ece4cf]/90'
												)}
											>
												{formatTimelineClock(tickSecond)}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
</section>

<Popover.Root
	open={shown != null}
	onOpenChange={(open) => {
		if (!open) {
			pinned = null;
			clearHover();
		}
	}}
>
	<Popover.Portal>
		<Popover.Content
			customAnchor={shown?.anchor ?? null}
			side="top"
			sideOffset={10}
			collisionPadding={8}
			trapFocus={false}
			preventScroll={false}
			interactOutsideBehavior={pinned ? 'close' : 'ignore'}
			onOpenAutoFocus={(event) => event.preventDefault()}
			onCloseAutoFocus={(event) => event.preventDefault()}
			class={cn(
				tooltipPanel,
				'z-50 w-64 max-w-none p-3',
				pinned ? 'ring-primary/40 ring-1' : 'pointer-events-none'
			)}
		>
			{#if shown}
				{@const item = shown.item}
				{@const cost = item.cost}
				<div class="flex items-center gap-3">
					{@render iconBox({ ...item, veterancy: 0 }, shown.row, 'shrink-0')}
					<div class="min-w-0 flex-1">
						<p class="flex items-center gap-1.5 leading-tight font-semibold text-white">
							<span class="truncate">{shownInfo?.name ?? item.name}</span>
							{#if pinned && shownInfo && (shownInfo.help || shownInfo.extra)}
								<button
									type="button"
									class={cn(interactive, 'text-secondary-400 hover:text-primary shrink-0')}
									aria-label={t('Description')}
									{@attach tooltip(infoTooltip(shownInfo), {
										placement: 'right',
										delay: [0, null],
										maxWidth: 300
									})}
								>
									<InfoIcon class="size-4" weight="bold" />
								</button>
							{/if}
						</p>
						<p class="text-secondary-400 mt-1 text-xs">
							{t(TYPE_LABELS[item.type] ?? item.type)}
							<span class="text-secondary-500">·</span>
							<span class="tabular-nums">{item.timestamp}</span>
						</p>
					</div>
				</div>
				{#if cost}
					<div class="mt-3 flex flex-wrap items-center gap-1.5">
						{#each COST_RESOURCES as resource (resource)}
							{#if cost[resource]}
								<span
									class={cn(
										'bg-secondary-900 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-semibold tabular-nums',
										cost.refunded && 'line-through opacity-60'
									)}
									style:color={RESOURCE_COLOURS[resource]}
								>
									{#if resourceIcons[resource]}
										<img
											src={resourceIcons[resource]}
											alt={t(RESOURCE_LABELS[resource])}
											class="size-4"
										/>
									{/if}
									{formatAmount(cost[resource]!)}
								</span>
							{/if}
						{/each}
						{#if cost.command}
							<span
								class="bg-secondary-900 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm tabular-nums"
							>
								<span class="text-[10px] font-bold text-yellow-300">CP</span>
								{formatAmount(cost.command)}
							</span>
						{/if}
						{#if cost.seconds}
							<span class="text-secondary-400 inline-flex items-center gap-1 text-xs tabular-nums">
								<ClockIcon class="size-3.5" />
								{Math.round(cost.seconds)}s
							</span>
						{/if}
					</div>
					{#if cost.refunded}
						<p class="mt-1.5 text-xs font-medium text-green-400">{t('Refunded')}</p>
					{/if}
				{/if}
				{#if item.vetSteps.length > 0}
					<div class="border-secondary-800 mt-3 space-y-1 border-t pt-2 text-xs">
						{#each item.vetSteps as step (step.level)}
							<p class="flex items-center gap-2">
								{#if veterancyIcons[step.level - 1]}
									<img src={veterancyIcons[step.level - 1]} alt="" class="h-1.5 w-auto" />
								{/if}
								<span class="text-white">{t(VETERANCY_NAMES[step.level - 1])}</span>
								<span class="text-secondary-400 ml-auto tabular-nums">{step.timestamp}</span>
							</p>
						{/each}
					</div>
				{/if}
			{/if}
			{#if shown && !pinned}
				<p class="text-secondary-500 mt-2.5 text-[11px]">{t('Click for details')}</p>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
