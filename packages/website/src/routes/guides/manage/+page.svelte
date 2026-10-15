<script lang="ts">
	import { GuideManageList } from '@company-of-heroes/ui/guide';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo title={t('My guides')} noindex />

<GuideManageList guides={data.guides} />
