<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { tryUseHost } from '../host/host.context';

	type Props = {
		map: string | undefined;
		/** Defaults to the host's map images. */
		resolveMapSrc?: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		small?: boolean;
		flush?: boolean;
		alt?: string;
		class?: string;
	};

	const host = tryUseHost();

	let {
		map,
		resolveMapSrc = (value) => host?.resolve.mapSrc(value),
		resolveFallbackSrc = () => host?.resolve.mapFallbackSrc(),
		small = false,
		flush = false,
		alt: altText,
		class: className
	}: Props = $props();

	const src = $derived(resolveMapSrc(map));
	const alt = $derived(altText ?? map ?? '');

	function handleImageError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		const fallback = resolveFallbackSrc?.();
		if (fallback && img.src !== fallback) {
			img.src = fallback;
		}
	}
</script>

{#snippet mapLayers()}
	<img
		{src}
		{alt}
		onerror={handleImageError}
		class="absolute inset-0 z-5 size-full scale-180 object-cover opacity-30"
	/>
	<img {src} {alt} onerror={handleImageError} class="relative z-10 size-full object-contain" />
{/snippet}

{#if src}
	{#if small && flush}
		<div class={cn('relative size-11 shrink-0 overflow-clip', className)}>
			{@render mapLayers()}
		</div>
	{:else if flush}
		<div class={cn('relative aspect-square w-full self-start overflow-clip', className)}>
			{@render mapLayers()}
		</div>
	{:else}
		<div class={cn('w-10 shrink-0', className)}>
			<div class="relative aspect-square overflow-clip rounded">
				{@render mapLayers()}
			</div>
		</div>
	{/if}
{/if}
