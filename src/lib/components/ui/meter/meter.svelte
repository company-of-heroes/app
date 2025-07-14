<script lang="ts">
	import { Meter, useId } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		max = 100,
		value = 0,
		min = 0,
		label,
		valueLabel
	}: ComponentProps<typeof Meter.Root> & {
		label: string;
		valueLabel: string;
	} = $props();

	const labelId = useId();
</script>

<div class="mb-2 flex items-center justify-between text-neutral-400">
	<span id={labelId}>{label}</span>
	<span class="text-sm">{valueLabel}</span>
</div>
<Meter.Root
	aria-labelledby={labelId}
	aria-valuetext={valueLabel}
	{value}
	{min}
	{max}
	class="bg-secondary-900 shadow-mini-inset relative h-[15px] overflow-hidden"
>
	<div
		class="shadow-mini-inset bg-primary h-full w-full flex-1 transition-all duration-1000 ease-in-out"
		style="transform: translateX(-{100 - (100 * (value ?? 0)) / max}%)"
	></div>
</Meter.Root>
