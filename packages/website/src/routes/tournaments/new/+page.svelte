<script lang="ts">
	import { TournamentForm } from '@company-of-heroes/ui/tournament';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<Seo title={t('New tournament')} noindex />

<div class={flushHeader}>
	<h1 class={flushSectionTitle}>{t('New tournament')}</h1>
</div>
<TournamentForm />
