<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { tryUseHost } from '../host/host.context';
	import type { TimelineRowKey } from './replay-timeline';

	type Props = {
		row: TimelineRowKey;
		/** Action icon key that replaces the default art (e.g. the player's doctrine medal). */
		icon?: string | null;
		/** 0 = US, 1 = Wehrmacht, 2 = Commonwealth, 3 = Panzer Elite (see `raceFromReplayFaction`). */
		race?: number | null;
		class?: string;
	};

	let { row, icon, race, class: className }: Props = $props();
	const host = tryUseHost();

	// In-game art (see `shared-assets/actions/timeline_row_*.png`), shown like the post-game timeline headers.
	const RACE_SUFFIX = ['us', 'wm', 'cw', 'pe'] as const;
	const src = $derived.by(() => {
		if (icon) {
			return host?.resolve.actionIcon(icon);
		}

		const suffix = race != null ? RACE_SUFFIX[race] : undefined;
		return (
			(suffix && host?.resolve.actionIcon(`timeline_row_${row}_${suffix}`)) ||
			host?.resolve.actionIcon(`timeline_row_${row}`)
		);
	});
</script>

{#if src}
	<img
		{src}
		alt=""
		class={cn('size-10 shrink-0 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]', className)}
	/>
{:else}
	<span class={cn('size-10 shrink-0', className)} aria-hidden="true"></span>
{/if}
