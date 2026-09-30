<script lang="ts">
	import type { Match as LobbyMatch, MatchExpanded } from '$core/app/database/matches';
	import type { UnsubscribeFunc } from 'pocketbase';
	import { fetch } from '$core/http/fetch';
	import { app } from '$core/app/context';
	import { exp } from '$core/pocketbase';
	import { resource, watch } from 'runed';
	import { onDestroy } from 'svelte';
	import { Button } from '../ui/button';
	import TodayMatchesTable from './today-matches-table.svelte';
	import WidgetPanel from './widget-panel.svelte';
	import {
		collectTodayMatchSteamIds,
		isMatchFromLocalToday,
		matchIncludesSteamIds,
		todayPlayedMatchesFilter
	} from './dashboard-utils';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	let unsubscribe = $state<UnsubscribeFunc>();
	let subscribeGeneration = 0;
	const steamIds = $derived(collectTodayMatchSteamIds(app.features.auth.user.steamIds));
	let matches = resource(
		() => steamIds.join(','),
		async (steamIdsKey) => {
			const ids = steamIdsKey ? steamIdsKey.split(',').filter(Boolean) : [];
			if (ids.length === 0) {
				return [];
			}

			const items = await app.database.matches.getList({
				filter: todayPlayedMatchesFilter(ids),
				sort: '-createdAt'
			});
			return items.filter(
				(match) => isMatchFromLocalToday(match) && matchIncludesSteamIds(match, ids)
			);
		}
	);

	const matchCount = $derived(matches.current?.length ?? 0);

	watch(
		() => steamIds.join(','),
		(steamIdsKey) => {
			const ids = steamIdsKey ? steamIdsKey.split(',').filter(Boolean) : [];
			const generation = ++subscribeGeneration;
			void (async () => {
				await unsubscribe?.();
				if (generation !== subscribeGeneration) {
					return;
				}

				unsubscribe = undefined;
				if (ids.length === 0) {
					return;
				}

				const next = await app.pocketbase.collection('lobbies').subscribe<LobbyMatch>(
					'*',
					(e) => {
						const match = exp(e.record) as MatchExpanded;
						if (!isMatchFromLocalToday(match) || !matchIncludesSteamIds(match, ids)) {
							return;
						}

						if (e.action === 'create') {
							const current = matches.current || [];
							if (!current.find((m) => m.id === e.record.id)) {
								matches.mutate([...current, match]);
							}
						} else if (e.action === 'update') {
							matches.mutate(
								(matches.current || []).map((entry) => (entry.id === e.record.id ? match : entry))
							);
						} else if (e.action === 'delete') {
							matches.mutate((matches.current || []).filter((entry) => entry.id !== e.record.id));
						}
					},
					{
						filter: todayPlayedMatchesFilter(ids),
						sort: '-createdAt',
						fetch
					}
				);

				if (generation !== subscribeGeneration) {
					await next();
					return;
				}

				unsubscribe = next;
			})();
		}
	);

	onDestroy(() => {
		subscribeGeneration += 1;
		unsubscribe?.();
	});
</script>

<WidgetPanel
	title={t('Matches played today')}
	summary={!matches.loading ? t('{count} played', { count: matchCount }) : undefined}
>
	{#snippet trailing()}
		<Button href="/history" variant="link" size="sm" class="px-0">{t('View all')}</Button>
	{/snippet}
	{#if matches.loading}
		<TodayMatchesTable matches={[]} loading />
	{:else if !matches.current || matches.current.length === 0}
		<p class="text-secondary-400 px-4 py-3 text-sm">
			{t('You have not played any matches today.')}
		</p>
	{:else}
		<TodayMatchesTable matches={matches.current} />
	{/if}
</WidgetPanel>
