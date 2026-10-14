<script lang="ts">
	import type { Compare } from '@company-of-heroes/api/compare';
	import type { Snippet } from 'svelte';
	import { createCompare } from './context';

	type Props = {
		compare: Compare;
		/** Steam ids of the selected accounts. */
		selected: string[];
		/** Receives the full next selection. */
		onSelect: (steamIds: string[]) => void;
		children: Snippet;
	};

	let { compare, selected, onSelect, children }: Props = $props();

	createCompare({
		get compare() {
			return compare;
		},
		get selected() {
			return selected;
		},
		onSelect(steamIds) {
			onSelect(steamIds);
		}
	});
</script>

{@render children()}
