<script lang="ts">
	import { controlBase, interactive } from '$lib/components/ui/variants';
	import { cn } from '$lib/utils';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';

	type Props = {
		labelElement: HTMLLabelElement | undefined;
		hex: string | null;
		label: string;
		name?: string;
		dir: 'ltr' | 'rtl';
	};

	let { labelElement = $bindable(), hex, label, name, dir }: Props = $props();

	function preventDefault(event: MouseEvent) {
		event.preventDefault();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<label
	bind:this={labelElement}
	onclick={preventDefault}
	onmousedown={preventDefault}
	{dir}
	class={cn(
		controlBase,
		interactive,
		'has-focus-visible:border-secondary-600 flex w-44 shrink-0 items-center gap-2.5 px-3'
	)}
>
	<input
		type="color"
		{name}
		value={hex ?? '#000000'}
		onclick={preventDefault}
		onmousedown={preventDefault}
		aria-haspopup="dialog"
		class="sr-only"
	/>
	<span
		class="ring-secondary-700 size-6 shrink-0 rounded-md ring-1 ring-inset"
		style:background={hex ?? 'transparent'}
	></span>
	<span class="min-w-0 flex-1 truncate text-sm font-medium uppercase tabular-nums">
		{hex ?? '—'}
	</span>
	<CaretDownIcon class="text-secondary-400 size-4 shrink-0" />
	<span class="sr-only">{label}</span>
</label>
