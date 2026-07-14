<script lang="ts">
	import type { Feature } from '$lib/features';

	type Props = {
		feature: Feature;
		reversed?: boolean;
	};

	let { feature, reversed = false }: Props = $props();

	const Icon = $derived(feature.icon);
</script>

<article
	id={feature.id}
	class="grid items-center gap-10 lg:grid-cols-2 lg:gap-16 {reversed
		? 'lg:[&>div:first-child]:order-2'
		: ''}"
>
	<div class="flex flex-col gap-4">
		<div class="text-primary flex items-center gap-3">
			<div class="border-primary/20 bg-primary/10 flex size-11 items-center justify-center rounded-lg border">
				<Icon size={24} weight="duotone" />
			</div>
			<h2 class="text-3xl text-white">{feature.title}</h2>
		</div>
		<p class="text-secondary-300 text-lg leading-relaxed">{feature.description}</p>
	</div>

	<div
		class="border-secondary-800 bg-secondary-900/40 shadow-xl overflow-hidden rounded-xl border"
	>
		<img
			src={feature.image}
			alt={feature.imageAlt}
			class="block w-full"
			width="1280"
			height="800"
			loading="lazy"
		/>
	</div>
</article>
