<script lang="ts">
	import { page } from '$app/state';
	import { ReplayUploader } from '@company-of-heroes/ui/replay';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const fromMatchId = $derived(page.url.searchParams.get('fromMatch')?.trim() || '');
</script>

<SetCrumbs items={[{ label: fromMatchId ? t('Publish replay') : t('Upload replay') }]} />

<ReplayUploader {fromMatchId} showNav={false} />
