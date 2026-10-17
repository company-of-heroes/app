<script lang="ts">
	import ReplayCardGrid from '../replay-browse/replay-card-grid.svelte';

	type Props = {
		rowCount?: number;
		dateLabel?: string;
		rows?: 1 | 2;
	};

	let { rowCount = 12, rows }: Props = $props();
</script>

<!-- Mirrors ReplayList: the card grid with placeholder cards. -->
<div aria-busy="true">
	<ReplayCardGrid matches={[]} skeletons={rowCount} {rows} closing />
</div>
