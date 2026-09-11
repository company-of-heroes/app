<script lang="ts">
	import { page } from '$app/state';
	import { List as ReplayList } from '@company-of-heroes/ui/replay';
	import { Button } from '@company-of-heroes/ui/button';
	import { goto } from '$app/navigation';
	import { meSteamIds } from '$lib/auth/user';
	import { recentCommunityQuery, replaysHref, type CommunityMatch, type HistorySortField } from '$lib/replays';
	import {
		normalizeMapName,
		replayHref,
		resolveFactionFlag,
		resolveFallbackSrc,
		resolveMapSrc,
		resolvePlayerHref,
		getRankImageByRace
	} from '$lib/utils/resolvers';
	import { currentLocale, href, useI18n } from '$lib/i18n';

	type Props = {
		matches: CommunityMatch[];
		error?: string | null;
	};

	let { matches, error = null }: Props = $props();
	const { t } = useI18n();
	const mySteamIds = $derived(meSteamIds(page.data.user));

	function onSort(field: HistorySortField) {
		void goto(
			href(replaysHref({ ...recentCommunityQuery(), sort: field, sortDir: 'desc' }))
		);
	}
</script>

<section class="border-secondary-800 border-b">
	<div
		class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
	>
		<div>
			<h2 class="font-heading text-xl font-bold text-white">{t('Recent matches')}</h2>
			<p class="text-secondary-400 mt-1 text-sm">
				{t('Latest community matches with a replay.')}
			</p>
		</div>
		<Button href={href('/replays')} variant="link" size="sm" class="px-0">{t('View all')}</Button>
	</div>
	{#if error}
		<p class="border-secondary-800 text-red-400 border-b px-4 py-2 text-sm">
			{t('Could not load recent matches.')}
		</p>
	{/if}
	<ReplayList
		{matches}
		meSteamIds={mySteamIds}
		sort="createdAt"
		sortDir="desc"
		{onSort}
		{replayHref}
		playerHref={resolvePlayerHref}
		{resolveMapSrc}
		{resolveFallbackSrc}
		{resolveFactionFlag}
		getRankImage={getRankImageByRace}
		formatMapName={normalizeMapName}
		emptyMessage={error ? t('Could not load recent matches.') : t('No community replays found.')}
		locale={currentLocale()}
		mapLabel={t('Map')}
		typeLabel={t('Type')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		durationLabel={t('Duration')}
		likesLabel={t('Likes')}
		commentsLabel={t('Comments')}
		downloadsLabel={t('Downloads')}
		dateLabel={t('Date')}
		sortByLabel={t('Sort by {label}')}
	/>
</section>
