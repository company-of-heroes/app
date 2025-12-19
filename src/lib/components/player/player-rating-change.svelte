<script lang="ts">
	import { usePlayer } from './context';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';

	const player = usePlayer();
</script>

<span class="flex items-center gap-2">
	{#if player.newrating < player.oldrating}
		<CaretDown class="inline-block text-red-400" weight="duotone" />
		<span class="text-red-100">{player.oldrating - player.newrating}</span>
	{:else}
		<CaretUp class="inline-block text-green-400" weight="duotone" />
		<span class="text-green-100">{player.newrating - player.oldrating}</span>
	{/if}
</span>
