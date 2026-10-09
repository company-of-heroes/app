<script lang="ts">
	import { page } from '$app/state';
	import { resource } from 'runed';
	import { TournamentForm } from '@company-of-heroes/ui/tournament';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const detail = resource(
		() => page.params.slug,
		(slug) => unwrapApi(api.tournaments.get(slug ?? ''))
	);
</script>

<SetCrumbs items={[{ label: t('Edit tournament') }]} />

{#if !app.account.isStaff}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Only staff can do that.')}
	</p>
{:else if detail.current}
	<div class={flushHeader}>
		<h1 class={flushSectionTitle}>{t('Edit tournament')}: {detail.current.tournament.name}</h1>
	</div>
	{#key detail.current.tournament.id}
		<TournamentForm tournament={detail.current.tournament} />
	{/key}
{:else if detail.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Tournament not found.')}
	</p>
{:else}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Loading...')}
	</p>
{/if}
