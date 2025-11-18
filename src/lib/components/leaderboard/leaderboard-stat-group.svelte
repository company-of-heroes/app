<script lang="ts">
	import type { LeaderboardStat } from '@fknoobs/app';

	type Props = {
		stats: LeaderboardStat[];
	};

	let { stats }: Props = $props();
</script>
