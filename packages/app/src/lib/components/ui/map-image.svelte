<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { getMapImageFromName } from '$lib/utils/game';
	import { cn } from '$lib/utils';
	import { AspectRatio } from 'bits-ui';

	type Props = HTMLImgAttributes & {
		map: string | undefined;
		small?: boolean;
		alt?: string;
	};

	const { map, small = false, alt: altText, class: className, ...restProps }: Props = $props();

	const src = $derived(getMapImageFromName(map));
	const alt = $derived(altText ?? map ?? '');
</script>

{#if small}
	<div class="w-10">
		<AspectRatio.Root class="flex items-center justify-center overflow-clip rounded">
			<img
				{...restProps}
				{src}
				{alt}
				class={cn(
					'absolute inset-0 z-5 h-full w-full scale-180 object-cover opacity-30',
					className
				)}
			/>
			<img
				{...restProps}
				{src}
				{alt}
				class={cn('z-10 h-full w-full object-contain', className)}
			/>
		</AspectRatio.Root>
	</div>
{:else}
	<AspectRatio.Root
		ratio={1}
		class="border-secondary-800 flex items-center justify-center overflow-clip rounded-lg border"
	>
		<img
			{...restProps}
			{src}
			{alt}
			class={cn(
				'absolute inset-0 z-5 h-full w-full scale-180 object-cover opacity-30',
				className
			)}
		/>
		<img
			{...restProps}
			{src}
			{alt}
			class={cn('z-10 h-full w-full object-contain', className)}
		/>
	</AspectRatio.Root>
{/if}
