<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { PageSkeleton as SharedPageSkeleton } from '@company-of-heroes/ui/replay';
	import { useI18n } from '$lib/i18n';

	type Props = {
		/** App uses layout breadcrumbs; keep false unless you need website-style nav. */
		showNav?: boolean;
	} & HTMLAttributes<HTMLDivElement>;

	let { showNav = false, class: className, ...restProps }: Props = $props();
	const { t } = useI18n();
</script>

<SharedPageSkeleton
	{showNav}
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
