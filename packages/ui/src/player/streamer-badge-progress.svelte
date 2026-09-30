<script lang="ts">
	import { Meter, useId } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import BroadcastIcon from 'phosphor-svelte/lib/BroadcastIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import { Badge } from '../ui/badge';
	import { surfacePanel } from '../variants';

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

	const labelId = useId();
	const percent = $derived(Math.min(100, Math.max(0, (100 * hours) / total)));
</script>

<div
	class={cn(
		surfacePanel,
		'flex flex-col gap-4 border-1 p-4 sm:flex-row sm:items-center',
		granted && 'bg-success/5 border-success/20',
		className
	)}
>
	<div class="flex min-w-0 flex-1 flex-col gap-2">
		<div class="flex items-center justify-between gap-3">
			<h2
				id={labelId}
				class="text-secondary-200 flex items-center gap-2 text-sm font-bold tracking-wider uppercase"
			>
				{title}
				{#if granted}
					<Badge
						variant="success"
						class="inline-flex items-center gap-1 tracking-normal normal-case"
					>
						<CheckCircleIcon size={14} weight="fill" />
						{unlockedLabel}
					</Badge>
				{/if}
			</h2>
			<span class="text-secondary-100 shrink-0 text-sm tabular-nums">{valueLabel}</span>
		</div>
		<p class="text-secondary-200 text-sm">{description}</p>
		<Meter.Root
			aria-labelledby={labelId}
			aria-valuetext={valueLabel}
			value={hours}
			min={0}
			max={total}
			class="bg-secondary-900 relative h-3 overflow-hidden rounded-full"
		>
			<div
				class={cn(
					'h-full w-full rounded-full transition-all duration-1000 ease-in-out',
					granted ? 'bg-success' : 'bg-primary'
				)}
				style="transform: translateX(-{100 - percent}%)"
			></div>
		</Meter.Root>
		{#if !granted}
			<p class="text-secondary-500 text-xs">{remainingLabel}</p>
		{/if}
	</div>
</div>
