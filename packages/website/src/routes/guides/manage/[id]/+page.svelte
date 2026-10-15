<script lang="ts">
	import { GuideEditor } from '@company-of-heroes/ui/guide';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo title={t('Edit guide')} noindex />

<div class={flushHeader}>
	<h1 class={flushSectionTitle}>{t('Edit guide')}</h1>
</div>
{#key data.guide.id}
	<GuideEditor guide={data.guide} categories={data.categories} />
{/key}
