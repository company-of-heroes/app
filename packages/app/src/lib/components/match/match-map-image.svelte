<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { getMapImageFromName } from '$lib/utils/game';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { AspectRatio } from 'bits-ui';

	type Props = HTMLImgAttributes & { small?: boolean };

	const { small = false, ...restProps }: Props = $props();
	const match = useMatch();
</script>

{#if small}
	<div class="w-10">
		<AspectRatio.Root class="flex items-center justify-center overflow-clip rounded">
			<img
				{...restProps}
				src={getMapImageFromName(match.map)}
				alt={match.map}
				class={cn(
					'absolute inset-0 z-5 h-full w-full scale-180 object-cover opacity-30',
					restProps.class
				)}
			/>
			<img
				{...restProps}
				src={getMapImageFromName(match.map)}
				alt={match.map}
				class={cn('z-10 h-full w-full object-contain', restProps.class)}
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
			src={getMapImageFromName(match.map)}
			alt={match.map}
			class={cn(
				'absolute inset-0 z-5 h-full w-full scale-180 object-cover opacity-30',
				restProps.class
			)}
		/>
		<img
			{...restProps}
			src={getMapImageFromName(match.map)}
			alt={match.map}
			class={cn('z-10 h-full w-full object-contain', restProps.class)}
		/>
	</AspectRatio.Root>
{/if}
