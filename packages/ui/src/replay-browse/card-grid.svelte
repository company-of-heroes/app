<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import ReplayCardSkeleton from '../replay/replay-card-skeleton.svelte';

	type Props = {
		items: T[];
		card: Snippet<[T]>;
		/** Placeholder cards while loading (ignored when `items` has entries). */
		skeletons?: number;
		/** Last block above the footer: pull the closing line onto the parent's border. */
		closing?: boolean;
		/** Show only this many full rows at every breakpoint (cards past them are hidden). */
		rows?: 1 | 2;
		class?: string;
	};

	let { items, card, skeletons = 0, closing = false, rows, class: className }: Props = $props();

	/**
	 * Columns follow the space the grid gets (container queries), from 1 up to 6, keeping every
	 * card at least ~18rem wide: the site column shows 4, only a very wide desktop app 5 or 6.
	 * `rows` hides what does not fill a row.
	 */
	const breakpoints = [
		'@2xl:grid-cols-2',
		'@5xl:grid-cols-3',
		'@min-[72rem]:grid-cols-4',
		'@min-[100rem]:grid-cols-5',
		'@min-[120rem]:grid-cols-6'
	];
	/** A short list stops adding columns once every card has one, so no empty cells trail the row (never below 3). */
	const columns = $derived(
		breakpoints.slice(0, Math.max(items.length || skeletons, 3) - 1).join(' ')
	);
	const rowClass = {
		1: '@max-2xl:[&>*:nth-child(n+2)]:hidden @2xl:@max-5xl:[&>*:nth-child(n+3)]:hidden @5xl:@max-[72rem]:[&>*:nth-child(n+4)]:hidden @min-[72rem]:@max-[100rem]:[&>*:nth-child(n+5)]:hidden @min-[100rem]:@max-[120rem]:[&>*:nth-child(n+6)]:hidden @min-[120rem]:[&>*:nth-child(n+7)]:hidden',
		2: '@max-2xl:[&>*:nth-child(n+3)]:hidden @2xl:@max-5xl:[&>*:nth-child(n+5)]:hidden @5xl:@max-[72rem]:[&>*:nth-child(n+7)]:hidden @min-[72rem]:@max-[100rem]:[&>*:nth-child(n+9)]:hidden @min-[100rem]:@max-[120rem]:[&>*:nth-child(n+11)]:hidden @min-[120rem]:[&>*:nth-child(n+13)]:hidden'
	} as const;
</script>

<!-- Flush cells: each draws its right and bottom line; the wrapper clips the outer right edge. -->
<div class={cn('@container overflow-hidden', closing && '-mb-px')}>
	<div class={cn('-mr-px grid', columns, rows && rowClass[rows], className)}>
		{#each items as item (item.id)}
			<div class="border-secondary-800 min-w-0 border-r border-b">
				{@render card(item)}
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
