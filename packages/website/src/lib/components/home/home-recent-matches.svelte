<script lang="ts">
	import { page } from '$app/state';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton
	} from '@company-of-heroes/ui/replay';
	import { Button } from '@company-of-heroes/ui/button';
	import { goto } from '$app/navigation';
	import { meSteamIds } from '$lib/auth/user';
	import {
		HOME_RECENT_MATCHES,
		recentCommunityQuery,
		replaysHref,
		type CommunityMatch,
		type HistorySortField
	} from '$lib/replays';
	import { href, useI18n } from '$lib/i18n';

	type Props = {
		matches: CommunityMatch[];
		loading?: boolean;
		error?: string | null;
	};

	let { matches, loading = false, error = null }: Props = $props();
	const { t } = useI18n();
	const mySteamIds = $derived(meSteamIds(page.data.user));

	function onSort(field: HistorySortField) {
		void goto(href(replaysHref({ ...recentCommunityQuery(), sort: field, sortDir: 'desc' })));
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
		<p class="border-secondary-800 border-b px-4 py-2 text-sm text-red-400">
			{t('Could not load recent matches.')}
		</p>
	{/if}
	{#if loading}
		<ReplayListSkeleton rowCount={HOME_RECENT_MATCHES} />
	{:else}
		<ReplayList
			{matches}
			meSteamIds={mySteamIds}
			sort="createdAt"
			sortDir="desc"
			{onSort}
			emptyMessage={error ? t('Could not load recent matches.') : t('No community replays found.')}
			mapLabel={t('Map')}
		/>
	{/if}
</section>
