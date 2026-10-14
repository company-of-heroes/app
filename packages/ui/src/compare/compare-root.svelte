<script lang="ts">
	import type { CompareData } from '@company-of-heroes/api/compare';
	import type { Snippet } from 'svelte';
	import { combineCompare } from './combine';
	import { createCompare } from './context';

	type Props = {
		/** Per-account data; toggling accounts recombines it here, without a request. */
		compare: CompareData;
		/** Steam ids of the selected accounts. */
		selected: string[];
		/** Receives the full next selection. */
		onSelect: (steamIds: string[]) => void;
		children: Snippet;
	};

	let { compare, selected, onSelect, children }: Props = $props();
	const view = $derived(combineCompare(compare, selected));

	createCompare({
		get compare() {
			return view;
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
