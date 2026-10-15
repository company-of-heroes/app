<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import StatisticsInfoPopover from '../statistics/statistics-info-popover.svelte';
	import { createDocsPopover } from './docs-popover.context';

	type Props = {
		/** Long content: weapons, abilities, what a building makes. */
		main: Snippet;
		/** Small panels: facts, the tip, veterancy. */
		side?: Snippet;
	};

	let { main, side }: Props = $props();
	const popover = createDocsPopover();
</script>

<!-- The /stats top grid: a wide main column and a 28rem column of small panels. Every panel
closes with its own bottom line, so the shorter column ends in a line too; the grid sits 1px over
whatever follows (the site footer's top border) so the longer column does not get a double line. -->
<!-- Columns follow the panel's own width (container query), not the window: the app's sidebar
takes 300px of it. -->
<div class="@container -mb-px">
	<div
		class={cn(
			'divide-secondary-800 grid',
			side && '@5xl:grid-cols-[minmax(0,1fr)_28rem] @5xl:divide-x'
		)}
	>
		<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
			{@render main()}
		</div>
		{#if side}
			<aside class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
				{@render side()}
			</aside>
		{/if}
	</div>
</div>

<StatisticsInfoPopover {popover} />
