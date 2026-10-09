<script lang="ts">
	import { ReplayUploader } from '@company-of-heroes/ui/replay';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	const fromMatchId = $derived(data.fromMatch?.id ?? '');
</script>

<svelte:head>
	<title>
		{fromMatchId ? t('Publish replay') : t('Upload replay')} | {t('Company of Heroes 1 Stats')}
	</title>
	<meta
		name="description"
		content={fromMatchId
			? t('Publish this match to Shared Replays. It will leave Community matches.')
			: t('Upload a Company of Heroes .rec file to share it in Shared Replays.')}
	/>
</svelte:head>

<ReplayUploader {fromMatchId} />
