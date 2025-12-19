<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult } = usePlayer();
</script>

{#if playerResult}
	<span class="text-center text-red-100" {...restProps}>{playerResult.losses}</span>
{:else}
	<span class="text-center" {...restProps}>-</span>
{/if}
