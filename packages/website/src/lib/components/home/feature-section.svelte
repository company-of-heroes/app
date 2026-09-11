<script lang="ts">
	import type { Feature } from '$lib/site/features';
	import { cn } from '$lib/utils/cn';
	import { useI18n } from '$lib/i18n';

	type Props = {
		feature: Feature;
		reversed?: boolean;
	};

	let { feature, reversed = false }: Props = $props();
	const { t } = useI18n();
	const Icon = $derived(feature.icon);
</script>

<article id={feature.id} class="border-secondary-800 border-b">
	<div class="grid lg:grid-cols-2">
		<div class={cn('flex min-w-0 flex-col justify-center px-6 py-6', reversed && 'lg:order-2')}>
			<div class="mb-2 flex items-center gap-2.5">
				<Icon class="text-primary size-5 shrink-0" weight="duotone" />
				<h2 class="font-heading text-xl font-bold text-white">{t(feature.title)}</h2>
			</div>
			<p class="text-secondary-400 text-sm leading-relaxed">{t(feature.description)}</p>
		</div>
		<div
			class={cn(
				'border-secondary-800 relative aspect-[16/10] overflow-clip border-t lg:aspect-auto lg:min-h-72 lg:border-t-0',
				reversed ? 'lg:border-r' : 'lg:border-l'
			)}
		>
			<img
				src={feature.image}
				alt={t(feature.imageAlt)}
				class="absolute inset-0 size-full object-cover"
				width="1280"
				height="800"
				loading="lazy"
			/>
		</div>
	</div>
</article>
