<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CommunityStatistics } from './types';
	import { createStatistics } from './context';

	type Props = {
		statistics: CommunityStatistics;
		/** The map the page is filtered on; its row is highlighted and "most played map" is left out. */
		selected?: string | null;
		children: Snippet;
	};

	let { statistics, selected = null, children }: Props = $props();

	createStatistics({
		get statistics() {
			return statistics;
		},
		get selected() {
			return selected;
		}
	});
</script>

{@render children()}
