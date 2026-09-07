<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { TabsSkeleton as SharedTabsSkeleton } from '@company-of-heroes/ui/replay';
	import { useI18n } from '$lib/i18n';

	type Props = {
		flush?: boolean;
		showTitle?: boolean;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		flush = false,
		showTitle = true,
		class: className,
		...restProps
	}: Props = $props();
	const { t } = useI18n();
</script>

<SharedTabsSkeleton
	{flush}
	{showTitle}
	overviewLabel={t('Overview')}
	chatLabel={t('Chat')}
	timelineLabel={t('Timeline')}
	alliesLabel={t('Allies')}
	axisLabel={t('Axis')}
	ratingLabel={t('Rating')}
	cpmLabel={t('CPM')}
	class={className}
	{...restProps}
/>
