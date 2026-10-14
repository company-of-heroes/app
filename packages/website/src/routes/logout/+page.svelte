<script lang="ts">
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<Seo title={t('Log out')} noindex />

<p class="text-secondary-400 px-4 py-3 text-sm">{t('Signing out…')}</p>
