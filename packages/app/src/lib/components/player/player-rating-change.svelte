<script lang="ts">
	import { usePlayer } from './context';
	import CaretUp from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDown from 'phosphor-svelte/lib/CaretDownIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';

	const { playerResult } = $derived(usePlayer());
	const change = $derived.by(() => {
		if (!playerResult) {
			return undefined;
		}

		const next = playerResult.newrating;
		const prev = playerResult.oldrating;
		if (!Number.isFinite(next) || !Number.isFinite(prev)) {
			return undefined;
		}

		return next - prev;
	});
</script>

{#if change !== undefined}
	<span class="inline-flex items-center gap-0.5 text-sm tabular-nums">
		{#if change < 0}
			<CaretDown class="text-destructive size-3.5 shrink-0" weight="duotone" />
			<span class="text-red-200">{Math.abs(change)}</span>
		{:else if change > 0}
			<CaretUp class="text-success size-3.5 shrink-0" weight="duotone" />
			<span class="text-green-200">{change}</span>
		{:else}
			<MinusIcon class="text-secondary-500 size-3.5 shrink-0" />
		{/if}
	</span>
{/if}
