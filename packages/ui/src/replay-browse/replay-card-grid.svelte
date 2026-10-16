<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import ReplayCard from '../replay/replay-card.svelte';
	import ReplayCardSkeleton from '../replay/replay-card-skeleton.svelte';
	import type { CommunityMatch } from '../replay/types';

	type Props = {
		matches: CommunityMatch[];
		meSteamIds?: string[];
		/** Placeholder cards while loading (ignored when `matches` has items). */
		skeletons?: number;
		/** Last block above the footer: pull the closing line onto the parent's border. */
		closing?: boolean;
		/** Show only this many full rows at every breakpoint (cards past them are hidden). */
		rows?: 1 | 2;
		class?: string;
	};

	let {
		matches,
		meSteamIds = [],
		skeletons = 0,
		closing = false,
		rows,
		class: className
	}: Props = $props();

	/**
	 * Columns follow the space the grid gets (container queries), from 1 up to 6: a narrow site
	 * column shows 3, the full-width desktop app 6. `rows` hides what does not fill a row.
	 */
	const columns =
		'@lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @6xl:grid-cols-5 @7xl:grid-cols-6';
	const rowClass = {
		1: '@max-lg:[&>*:nth-child(n+2)]:hidden @lg:@max-3xl:[&>*:nth-child(n+3)]:hidden @3xl:@max-5xl:[&>*:nth-child(n+4)]:hidden @5xl:@max-6xl:[&>*:nth-child(n+5)]:hidden @6xl:@max-7xl:[&>*:nth-child(n+6)]:hidden @7xl:[&>*:nth-child(n+7)]:hidden',
		2: '@max-lg:[&>*:nth-child(n+3)]:hidden @lg:@max-3xl:[&>*:nth-child(n+5)]:hidden @3xl:@max-5xl:[&>*:nth-child(n+7)]:hidden @5xl:@max-6xl:[&>*:nth-child(n+9)]:hidden @6xl:@max-7xl:[&>*:nth-child(n+11)]:hidden @7xl:[&>*:nth-child(n+13)]:hidden'
	} as const;
</script>

<!-- Flush cells: each draws its right and bottom line; the wrapper clips the outer right edge. -->
<div class={cn('@container overflow-hidden', closing && '-mb-px')}>
	<div class={cn('-mr-px grid', columns, rows && rowClass[rows], className)}>
		{#each matches as match (match.id)}
			<div class="border-secondary-800 min-w-0 border-r border-b">
				<ReplayCard {match} {meSteamIds} />
			</div>
		{:else}
			{#each { length: skeletons }, index (index)}
				<div class="border-secondary-800 min-w-0 border-r border-b">
					<ReplayCardSkeleton />
				</div>
			{/each}
		{/each}
	</div>
</div>
