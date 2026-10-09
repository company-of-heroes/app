<script lang="ts">
	import { TournamentForm } from '@company-of-heroes/ui/tournament';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import { app } from '$core/app/context';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<SetCrumbs items={[{ label: t('New tournament') }]} />

{#if app.account.isStaff}
	<div class={flushHeader}>
		<h1 class={flushSectionTitle}>{t('New tournament')}</h1>
	</div>
	<TournamentForm />
{:else}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Only staff can do that.')}
	</p>
{/if}
