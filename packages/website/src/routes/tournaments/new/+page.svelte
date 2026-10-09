<script lang="ts">
	import { TournamentForm } from '@company-of-heroes/ui/tournament';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('New tournament')} | {t('Company of Heroes 1 Stats')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class={flushHeader}>
	<h1 class={flushSectionTitle}>{t('New tournament')}</h1>
</div>
<TournamentForm />
