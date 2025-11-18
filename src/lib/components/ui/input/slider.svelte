<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Slider, type WithoutChildren } from 'bits-ui';
	import { cn } from '$lib/utils';

	type Props = Omit<WithoutChildren<ComponentProps<typeof Slider.Root>>, 'type'>;

	let { value = $bindable(), ref = $bindable(null), ...restProps }: Props = $props();
</script>

<!--
 Since we have to destructure the `value` to make it `$bindable`, we need to use `as any` here to avoid
 type errors from the discriminated union of `"single" | "multiple"`.
 (an unfortunate consequence of having to destructure bindable values)
  -->
<span class="grid w-full grid-cols-[auto_60px] items-center gap-4">
	<Slider.Root
		bind:value
		bind:ref
		type="single"
		{...restProps as any}
		class={cn('relative my-2 flex w-full touch-none items-center select-none', restProps.class)}
	>
		<span class="relative h-2 w-full grow cursor-pointer overflow-hidden rounded-full bg-gray-900">
			<Slider.Range class="bg-primary/40 absolute h-full" />
		</span>
		<Slider.Thumb
			index={0}
			class={cn(
				'hover:border-primary data-active:border-primary block size-5',
				'bg-primary border-primary cursor-pointer rounded-full border transition-colors',
				'disabled:pointer-events-none disabled:opacity-50 data-active:scale-[0.98]',
				'focus-visible:ring-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'
			)}
		/>
	</Slider.Root>
	<input
		type="text"
		{value}
		class="w-full rounded-md border border-gray-700 py-1 text-center outline-none"
		oninput={(e) => {
			const input = e.target as HTMLInputElement;
			let v = parseFloat(input.value);
			if (isNaN(v)) v = 0;

			value = v;
		}}
	/>
</span>
