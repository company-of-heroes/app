<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { CommunityMatch, HistoryMatchup } from '../replay/types';
	import DiscoverSectionHeader from './discover-section-header.svelte';
	import ReplayCardGrid from './replay-card-grid.svelte';

	export type MatchupGroup = { matchup: HistoryMatchup; items: CommunityMatch[] };

	type Props = {
		/** null while loading. */
		groups: MatchupGroup[] | null;
		/** The archive filtered to one game type. */
		viewAllHref: (matchup: HistoryMatchup) => string;
		meSteamIds?: string[];
	};

	const MATCHUPS: HistoryMatchup[] = ['1v1', '2v2', '3v3', '4v4'];

	const { t } = useI18n();

	let { groups, viewAllHref, meSteamIds = [] }: Props = $props();

	const descriptions = $derived<Record<HistoryMatchup, string>>({
		'1v1': t('Head-to-head duels'),
		'2v2': t('Two against two'),
		'3v3': t('Three against three'),
		'4v4': t('Four against four')
	});

	const visible = $derived(groups?.filter((group) => group.items.length > 0) ?? []);
</script>

<!-- One grid per game type; each row of cards links to the full list of that type. -->
{#if !groups}
	{#each MATCHUPS as matchup, index (matchup)}
		<section aria-busy="true">
			<DiscoverSectionHeader title={matchup} description={descriptions[matchup]} />
			<ReplayCardGrid matches={[]} skeletons={12} rows={2} closing={index === MATCHUPS.length - 1} />
		</section>
	{/each}
{:else if visible.length === 0}
	<p class="text-secondary-400 px-4 py-10 text-center text-sm">
		{t('No community replays found.')}
	</p>
{:else}
	{#each visible as group, index (group.matchup)}
		<section>
			<DiscoverSectionHeader
				title={group.matchup}
				description={descriptions[group.matchup]}
				href={viewAllHref(group.matchup)}
			/>
			<ReplayCardGrid
				matches={group.items}
				{meSteamIds}
				rows={2}
				closing={index === visible.length - 1}
			/>
		</section>
	{/each}
{/if}
