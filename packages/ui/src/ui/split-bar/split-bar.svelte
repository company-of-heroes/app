<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';

	type Props = {
		/** Share of the left side, 0-100. */
		value: number;
		/** Fill of the left share (Allies, wins). */
		leftClass?: string;
		/** Track behind it, showing the right share (Axis, losses). */
		rightClass?: string;
		class?: string;
	};

	let {
		value,
		leftClass = 'bg-sky-400/55',
		rightClass = 'bg-red-400/30',
		class: className
	}: Props = $props();

	const clamped = $derived(Math.min(100, Math.max(0, value)));
</script>

<!-- Thin front line: a tick at 50 % and a white marker where the split lands. -->
<div class={cn('relative h-1 flex-1 rounded-full', rightClass, className)}>
	<div
		class={cn('absolute inset-y-0 left-0 rounded-l-full', leftClass)}
		style:width="{clamped}%"
	></div>
	<div class="bg-secondary-600 absolute -inset-y-1 left-1/2 w-px"></div>
	<div
		class="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-white"
		style:left="{clamped}%"
	></div>
</div>
