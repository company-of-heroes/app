<script lang="ts">
	import { page } from '$app/state';
	import { resource } from 'runed';
	import { TournamentPage } from '@company-of-heroes/ui/tournament';
	import { api, unwrapApi } from '$core/api';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const detail = resource(
		() => page.params.slug,
		(slug) => unwrapApi(api.tournaments.get(slug ?? ''))
	);
</script>

<SetCrumbs items={[{ label: detail.current?.tournament.name ?? t('Tournament') }]} />

{#if detail.current}
	<!-- Keyed: another tournament starts with fresh tabs, dialogs and sign-up state. -->
	{#key detail.current.tournament.id}
		<TournamentPage detail={detail.current} />
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
