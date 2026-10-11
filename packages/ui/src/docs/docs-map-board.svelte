<script lang="ts" module>
	import type { Attachment } from 'svelte/attachments';

	/** `primary` gold at 45%. */
	const SECTOR_COLOUR = [232, 199, 102, 115];

	/** Sector-id images by url, read once (the grey value of each pixel is the sector id). */
	const sectorIds: Record<string, Promise<ImageData | null>> = {};

	function loadSectorIds(src: string): Promise<ImageData | null> {
		sectorIds[src] ??= new Promise((resolve) => {
			const image = new Image();
			image.onload = () => {
				const context = document
					.createElement('canvas')
					.getContext('2d', { willReadFrequently: true });
				if (!context) {
					resolve(null);
					return;
				}

				context.canvas.width = image.naturalWidth;
				context.canvas.height = image.naturalHeight;
				context.drawImage(image, 0, 0);
				resolve(context.getImageData(0, 0, image.naturalWidth, image.naturalHeight));
			};
			image.onerror = () => resolve(null);
			image.src = src;
		});
		return sectorIds[src];
	}

	/** Colours the sectors on the canvas; with none lit it keeps the last paint (the canvas fades out). */
	function paintSectors(src: string, sectors: Set<number>): Attachment<HTMLCanvasElement> {
		return (canvas) => {
			let cancelled = false;
			if (sectors.size) {
				loadSectorIds(src).then((ids) => {
					const context = canvas.getContext('2d');
					if (cancelled || !ids || !context) {
						return;
					}

					canvas.width = ids.width;
					canvas.height = ids.height;
					const paint = context.createImageData(ids.width, ids.height);
					for (let i = 0; i < ids.data.length; i += 4) {
						if (sectors.has(ids.data[i])) {
							paint.data.set(SECTOR_COLOUR, i);
						}
					}

					context.putImageData(paint, 0, 0);
				});
			}

			return () => {
				cancelled = true;
			};
		};
	}
</script>

<script lang="ts">
	import type { DocMap, MapPointType } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { useHost } from '../host/host.context';
	import { mapPointKey } from './format';

	type Props = {
		map: DocMap;
		pointTypes: Record<string, MapPointType>;
		src: string | undefined;
		sectorsSrc?: string;
		/** Grey image with the sector id of every territory cell; hovering colours a sector. */
		sectorIdsSrc?: string;
		showSectors?: boolean;
		showPoints?: boolean;
		/** Fuel / munitions per minute next to each resource point. */
		showIncome?: boolean;
		showStarts?: boolean;
		/** `mapPointKey` of the point kind to pick out; the others fade. */
		highlight?: string | null;
	};

	let {
		map,
		pointTypes,
		src,
		sectorsSrc,
		sectorIdsSrc,
		showSectors = true,
		showPoints = true,
		showIncome = true,
		showStarts = true,
		highlight = null
	}: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	/** Fuel or munitions per minute; strategic points all give the same manpower, so they get no number. */
	const yieldOf = (kind: MapPointType) => kind.income.fuel ?? kind.income.munition ?? null;

	const points = $derived(
		map.points
			.map((point, index) => ({ ...point, index, kind: pointTypes[point.type] }))
			.filter((point) => point.kind)
	);

	/** The sector of the point or HQ under the pointer. */
	let hovered = $state<number | null>(null);
	/** Sectors to colour: the hovered one, else every sector of the kind picked in the legend. */
	const lit = $derived(
		new Set(
			hovered
				? [hovered]
				: highlight
					? points
							.filter((point) => mapPointKey(point.kind) === highlight && point.sector)
							.map((point) => point.sector!)
					: []
		)
	);
</script>

<!-- The picture spans the whole map; positions are fractions of it, so the markers stay on their
spot at any width. No overflow clip: markers on the map edge stick out instead of being cut off. -->
<div
	class="relative mx-auto w-full max-w-3xl rounded-sm bg-gray-950"
	style:aspect-ratio="{map.size.width} / {map.size.height}"
>
	{#if src}
		<img {src} alt={map.name} class="absolute inset-0 size-full rounded-sm" />
	{/if}
	{#if sectorIdsSrc}
		<canvas
			{@attach paintSectors(sectorIdsSrc, lit)}
			aria-hidden="true"
			class={cn(
				'pointer-events-none absolute inset-0 size-full rounded-sm transition-opacity duration-150',
				lit.size ? 'opacity-100' : 'opacity-0'
			)}
		></canvas>
	{/if}
	{#if showSectors && sectorsSrc}
		<img
			src={sectorsSrc}
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 size-full opacity-70"
		/>
	{/if}
	{#if map.startMarkers.length}
		<!-- The picture has the start circles; a see-through spot over each one gives the tooltip
		and colours its sector. -->
		{#each map.startMarkers as start, index (index)}
			<span
				class="absolute aspect-square w-[5%] -translate-1/2 rounded-full"
				style:left="{start.x * 100}%"
				style:top="{start.y * 100}%"
				role="img"
				aria-label={t('Starting position')}
				onpointerenter={() => (hovered = start.sector ?? null)}
				onpointerleave={() => (hovered = null)}
				{@attach tooltip(t('Starting position'))}
			></span>
		{/each}
	{:else if showStarts}
		{#each map.starts as start, index (index)}
			<span
				class="absolute flex size-6 -translate-1/2 items-center justify-center rounded-full bg-white text-gray-950 shadow-md shadow-black/60"
				style:left="{start.x * 100}%"
				style:top="{start.y * 100}%"
				role="img"
				aria-label={t('Starting position')}
				onpointerenter={() => (hovered = start.sector ?? null)}
				onpointerleave={() => (hovered = null)}
				{@attach tooltip(t('Starting position'))}
			>
				<HouseIcon class="size-3.5" weight="fill" />
			</span>
		{/each}
	{/if}
	{#if showPoints}
		{#each points as point (point.index)}
			{@const icon = point.kind.icon ? host.resolve.actionIcon(point.kind.icon) : undefined}
			{@const amount = yieldOf(point.kind)}
			<!-- The icon sits on the point; the income number hangs beside it (left near the right edge)
			so it does not move it. -->
			<span
				class={cn(
					'absolute -translate-1/2 transition-opacity duration-150',
					highlight && highlight !== mapPointKey(point.kind) && 'opacity-20',
					highlight === mapPointKey(point.kind) && 'z-10'
				)}
				style:left="{point.x * 100}%"
				style:top="{point.y * 100}%"
				role="img"
				aria-label={amount ? `${point.kind.name} +${amount}` : point.kind.name}
				onpointerenter={() => (hovered = point.sector ?? null)}
				onpointerleave={() => (hovered = null)}
				{@attach tooltip(point.kind.name)}
			>
				{#if icon}
					<img
						src={icon}
						alt=""
						class="block size-7 max-w-none drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)] sm:size-9"
					/>
				{/if}
				{#if showIncome && amount}
					<span
						aria-hidden="true"
						class={cn(
							'absolute top-1/2 -translate-y-1/2 text-xs leading-none font-bold whitespace-nowrap text-white tabular-nums [text-shadow:0_0_3px_rgb(0_0_0),0_1px_2px_rgb(0_0_0)] sm:text-sm',
							point.x > 0.9 ? 'right-full mr-0.5' : 'left-full ml-0.5'
						)}
					>
						+{amount}
					</span>
				{/if}
			</span>
		{/each}
	{/if}
</div>
