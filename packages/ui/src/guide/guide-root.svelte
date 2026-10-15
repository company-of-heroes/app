<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createGuide } from './context';
	import type { GuideView } from './types';

	type Props = {
		view: GuideView;
		children: Snippet;
	};

	let { view, children }: Props = $props();

	createGuide({
		get view() {
			return view;
		}
	});
</script>

{@render children()}
