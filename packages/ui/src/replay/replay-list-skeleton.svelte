<script lang="ts">
	import ReplayCardGrid from '../replay-browse/replay-card-grid.svelte';
	import ReplayTableSkeleton from './replay-table-skeleton.svelte';
	import type { ReplayLayout } from './types';

	type Props = {
		rowCount?: number;
		dateLabel?: string;
		rows?: 1 | 2;
		layout?: ReplayLayout;
	};

	let { rowCount = 12, rows, layout = 'grid' }: Props = $props();
</script>

<!-- Mirrors ReplayList: placeholder cards, or table rows in the list layout. -->
{#if layout === 'list'}
	<ReplayTableSkeleton {rowCount} />
{:else}
	<div aria-busy="true">
		<ReplayCardGrid matches={[]} skeletons={rowCount} {rows} closing />
	</div>
{/if}
