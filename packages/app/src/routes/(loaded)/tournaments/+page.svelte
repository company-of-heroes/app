<script lang="ts">
	import { resource } from 'runed';
	import { TournamentOverview } from '@company-of-heroes/ui/tournament';
	import { api, unwrapApi } from '$core/api';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const lists = resource(
		() => true,
		() =>
			Promise.all([
				unwrapApi(api.tournaments.list('active')),
				unwrapApi(api.tournaments.list('upcoming')),
				unwrapApi(api.tournaments.list('past'))
			])
	);
</script>

{#if lists.current}
	{@const [active, upcoming, past] = lists.current}
	<TournamentOverview {active} {upcoming} {past} />
{:else if lists.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Could not load tournaments.')}
	</p>
{:else}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Loading...')}
	</p>
{/if}
