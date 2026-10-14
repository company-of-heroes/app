<script lang="ts">
	import { ReplayUploader } from '@company-of-heroes/ui/replay';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	const fromMatchId = $derived(data.fromMatch?.id ?? '');
</script>

<Seo
	title={fromMatchId ? t('Publish replay') : t('Upload replay')}
	description={fromMatchId
		? t('Publish this match to Shared Replays. It will leave Community matches.')
		: t('Upload a Company of Heroes .rec file to share it in Shared Replays.')}
	noindex
/>

<ReplayUploader {fromMatchId} />
