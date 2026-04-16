<script lang="ts">
	import { usePlayer } from './context';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';

	const { playerResult } = $derived(usePlayer());
</script>

{#if playerResult}
	<span class="flex items-center gap-2">
		{#if playerResult.newrating < playerResult.oldrating}
			<CaretDown class="inline-block text-red-400" weight="duotone" />
			<span class="text-red-100">{playerResult.oldrating - playerResult.newrating}</span>
		{:else}
			<CaretUp class="inline-block text-green-400" weight="duotone" />
			<span class="text-green-100">{playerResult.newrating - playerResult.oldrating}</span>
		{/if}
	</span>
{/if}
