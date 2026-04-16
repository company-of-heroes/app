<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();
</script>

<div class="border-2 border-gray-500 bg-gray-700 p-4">
	{@render children()}
</div>
