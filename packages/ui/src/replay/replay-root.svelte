<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ReplayData } from './types';
	import { createReplayData } from './context';

	type Props = {
		replay: ReplayData;
		children: Snippet;
	};

	let { replay, children }: Props = $props();

	createReplayData({
		get replay() {
			return replay;
		}
	});
</script>

{@render children()}
