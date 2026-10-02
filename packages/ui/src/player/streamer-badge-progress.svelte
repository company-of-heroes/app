<script lang="ts">
	import { Meter, useId } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import BroadcastIcon from 'phosphor-svelte/lib/BroadcastIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import { flushHeaderDescription, flushSectionTitle } from '../variants';

	type Props = {
		/** Hours streamed so far, capped at `total`. */
		hours: number;
		total: number;
		granted?: boolean;
		title?: string;
		description?: string;
		/** Shown next to the bar, e.g. "42 / 720 min". */
		valueLabel: string;
		/** Shown under the bar, e.g. "678 min to go". */
		remainingLabel: string;
		unlockedLabel?: string;
		class?: string;
	};

	let {
		hours,
		total,
		granted = false,
		title = 'Streamer badge',
		description = 'Stream Company of Heroes to earn a purple Streamer badge. It shows next to your name in lobbies, leaderboards, comments and replays, so viewers and other players know you go live.',
		valueLabel,
		remainingLabel,
		unlockedLabel = 'Unlocked',
		class: className
	}: Props = $props();

	const STREAMER_HEX = '#9146FF';
	const labelId = useId();
	const percent = $derived(Math.min(100, Math.max(0, (100 * hours) / total)));
</script>

<div class={cn('flex items-start gap-4', className)}>
	<span
		class={cn(
			'flex size-10 shrink-0 items-center justify-center rounded-md border',
			!granted && 'border-secondary-800 bg-secondary-800/30 text-secondary-500'
		)}
		style:color={granted ? STREAMER_HEX : undefined}
		style:border-color={granted
			? `color-mix(in srgb, ${STREAMER_HEX} 25%, transparent)`
			: undefined}
		style:background-color={granted
			? `color-mix(in srgb, ${STREAMER_HEX} 10%, transparent)`
			: undefined}
	>
		<BroadcastIcon size={20} weight="bold" />
	</span>
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<div class="flex items-center justify-between gap-3">
			<h2 id={labelId} class={flushSectionTitle}>{title}</h2>
			{#if granted}
				<span class="text-secondary-300 flex shrink-0 items-center gap-1.5 text-sm">
					<CheckCircleIcon size={16} weight="fill" style="color: {STREAMER_HEX}" />
					{unlockedLabel}
				</span>
			{:else}
				<span class="text-secondary-300 shrink-0 text-sm tabular-nums">{valueLabel}</span>
			{/if}
		</div>
		<p class={cn(flushHeaderDescription, 'mt-0')}>{description}</p>
		{#if !granted}
			<Meter.Root
				aria-labelledby={labelId}
				aria-valuetext={valueLabel}
				value={hours}
				min={0}
				max={total}
				class="bg-secondary-800/60 relative mt-2 h-1.5 overflow-hidden rounded-full"
			>
				<div
					class="h-full w-full rounded-full transition-transform duration-1000 ease-in-out"
					style:background-color={STREAMER_HEX}
					style:transform="translateX(-{100 - percent}%)"
				></div>
			</Meter.Root>
			<p class="text-secondary-500 text-xs">{remainingLabel}</p>
		{/if}
	</div>
</div>
