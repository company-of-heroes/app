<script lang="ts">
	import { resource } from 'runed';
	import type { Tournament } from '@company-of-heroes/api';
	import { TournamentOverview, TournamentOverviewSkeleton } from '@company-of-heroes/ui/tournament';
	import { cachedTournaments, loadTournaments } from '$lib/tournaments/tournament-lists';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	type Lists = [active: Tournament[], upcoming: Tournament[], past: Tournament[]];

	const cachedActive = cachedTournaments('active');
	const cachedUpcoming = cachedTournaments('upcoming');
	const cachedPast = cachedTournaments('past');
	/** Lists from the last visit (or the dashboard widget), shown while these refresh. */
	const cached: Lists | undefined =
		cachedActive && cachedUpcoming && cachedPast
			? [cachedActive, cachedUpcoming, cachedPast]
			: undefined;

	const lists = resource(
		() => true,
		(): Promise<Lists> =>
			Promise.all([loadTournaments('active'), loadTournaments('upcoming'), loadTournaments('past')])
	);
	const current = $derived(lists.current ?? cached);
</script>

{#if current}
	{@const [active, upcoming, past] = current}
	<TournamentOverview {active} {upcoming} {past} />
{:else if lists.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Could not load tournaments.')}
	</p>
{:else}
	<TournamentOverviewSkeleton />
{/if}
