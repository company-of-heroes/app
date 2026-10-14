<script lang="ts">
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<Seo title={t('Players')} noindex />

<p class="text-secondary-400 px-6 py-16 text-center text-sm">{t('Redirecting to player stats…')}</p>
