<script lang="ts">
	import { RankIcon } from '@company-of-heroes/ui/player';
	import type { LobbyPlayer, MatchHistoryPlayer, TransformedMatch } from '@fknoobs/app';
	import type { Snippet } from 'svelte';
	import dayjs from '$lib/dayjs';
	import { cn, normalizeMapName } from '$lib/utils';
	import * as Player from '$lib/components/player';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import MapImage from '@company-of-heroes/ui/map-image';
	import { orderBy, sortBy } from 'lodash-es';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import { confirmation } from '$lib/components/ui/modal';
	import { app } from '$core/app/context';
	import { tooltip } from '$lib/attachments';
	import { resource } from 'runed';
	import { useI18n } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { hideMatch, isHiddenFromPublic, unhideMatch } from '$core/pocketbase/hidden-matches';
	import {
		filterHiddenMatches,
		invalidateHiddenMatchFilters,
		loadHiddenMatchFilters
	} from '$lib/player/hidden-matches-cache';

	type Props = {
		matches: TransformedMatch[];
		showSessionId?: boolean;
		class?: string;
	};

	let { matches, showSessionId = false, class: className }: Props = $props();
	const { t } = useI18n();

	const orderedMatches = $derived(orderBy(matches, ['completiontime'], ['desc']));
	const isStaff = $derived(app.account.isStaff);
	let pendingSessionId = $state<number | null>(null);
	const filters = resource(
		() => true,
		() => loadHiddenMatchFilters()
	);
	const visibleMatches = $derived.by(() => {
		if (isStaff) {
			return orderedMatches;
		}

		if (filters.current == null || filters.error) {
			return [];
		}

		return filterHiddenMatches(orderedMatches, filters.current);
	});
	const sessionIdsKey = $derived(orderedMatches.map((match) => match.id).join(','));
	const savedBySession = resource(
		() => sessionIdsKey,
		(key) => {
			if (!key) {
				return Promise.resolve(new Map<number, string>());
			}

			return app.database.matches.getIdsBySessionIds(key.split(',').map(Number)).catch((error) => {
				console.warn('[MATCH-HISTORY]: saved match lookup failed:', error);
				return new Map<number, string>();
			});
		}
	);

	const columns: ColumnDef<MatchHistoryPlayer>[] = $derived([
		{
			id: 'change',
			header: t('Change'),
			width: 'w-14',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		},
		{
			id: 'elo',
			header: t('ELO'),
			width: 'w-14',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		},
		{
			id: 'rank',
			header: t('Rank'),
			width: 'w-[4.5rem]',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		},
		{
			id: 'team',
			header: t('Team'),
			width: 'w-12',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		},
		{
			id: 'player',
			header: t('Player'),
			class: 'flex min-w-0 items-center gap-2'
		},
		{
			id: 'wins',
			header: t('Wins'),
			width: 'w-14',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		},
		{
			id: 'losses',
			header: t('Losses'),
			width: 'w-14',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		},
		{
			id: 'streak',
			header: t('Streak'),
			width: 'w-14',
			headerClass: 'text-center',
			class: 'flex w-full justify-center px-2'
		}
	]);

	function matchDuration(match: TransformedMatch): string {
		const seconds = dayjs
			.unix(match.completiontime)
			.diff(dayjs.unix(match.startgametime), 'seconds');
		return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function toLobbyPlayer(player: MatchHistoryPlayer, index: number): LobbyPlayer {
		return {
			index,
			playerId: player.profile_id,
			type: 0,
			team: player.teamid,
			race: player.race_id,
			steamId: player.steamId,
			profile: {
				alias: player.alias,
				profile_id: player.profile_id,
				name: player.name,
				personal_statgroup_id: player.personal_statgroup_id,
				xp: player.xp,
				level: player.level,
				leaderboardregion_id: player.leaderboardregion_id,
				country: player.country
			}
		};
	}

	function getPlayerRowClass(player: MatchHistoryPlayer) {
		return cn(player.outcome === 1 ? 'bg-success/5' : 'bg-destructive/5');
	}

	async function toggleHidden(sessionId: number, currentlyHidden: boolean) {
		const confirmed = await confirmation.ask(
			currentlyHidden
				? t('Show this match on public overviews again?')
				: t('Hide this match from public overviews?'),
			{
				confirm: currentlyHidden ? t('Show') : t('Hide'),
				cancel: t('Cancel')
			}
		);
		if (!confirmed) {
			return;
		}

		pendingSessionId = sessionId;
		try {
			if (currentlyHidden) {
				await unhideMatch(sessionId);
				app.toast.success(t('Match is visible again.'));
			} else {
				await hideMatch(sessionId, app.account.userId);
				app.toast.success(t('Match hidden from public overviews.'));
			}

			invalidateHiddenMatchFilters();
			const next = new Set(filters.current?.sessionIds ?? []);
			if (currentlyHidden) {
				next.delete(sessionId);
			} else {
				next.add(sessionId);
			}

			filters.mutate({ sessionIds: next, keywords: filters.current?.keywords ?? [] });
		} catch (error) {
			console.error('[MATCH-HISTORY]: hide toggle failed:', error);
			app.toast.error(
				currentlyHidden ? t('Could not show this match.') : t('Could not hide this match.')
			);
		} finally {
			pendingSessionId = null;
		}
	}
</script>

{#snippet cell_team({ row }: { row: MatchHistoryPlayer })}
	<Player.Faction
		class="h-auto! w-6! shrink-0 rounded-none! object-contain! ring-1! ring-black/40"
	/>
{/snippet}
{#snippet cell_elo({ row }: { row: MatchHistoryPlayer })}
	<Player.Rating class="text-center font-medium tabular-nums" />
{/snippet}
{#snippet cell_rank({ row }: { row: MatchHistoryPlayer })}
	{#if (row.ranklevel ?? 0) > 0}
		<span class="flex items-center justify-center gap-2">
			<RankIcon level={row.ranklevel ?? 0} race={row.race_id} class="size-6" />
			<span class="font-semibold tabular-nums">{row.ranklevel}</span>
		</span>
	{:else}
		<span class="text-secondary-400 tabular-nums">-</span>
	{/if}
{/snippet}
{#snippet cell_change({ row }: { row: MatchHistoryPlayer })}
	<Player.RatingChange />
{/snippet}
{#snippet cell_player({ row }: { row: MatchHistoryPlayer })}
	<span class="border-secondary-800 size-8 shrink-0 overflow-hidden rounded-lg border">
		<Player.Avatar />
	</span>
	<Player.Country class="shrink-0" />
	<Player.Alias class="min-w-0 flex-1 truncate" />
{/snippet}
{#snippet cell_wins({ row }: { row: MatchHistoryPlayer })}
	<Player.Wins class="text-center font-medium tabular-nums" />
{/snippet}
{#snippet cell_losses({ row }: { row: MatchHistoryPlayer })}
	<Player.Losses class="text-center font-medium tabular-nums" />
{/snippet}
{#snippet cell_streak({ row }: { row: MatchHistoryPlayer })}
	<Player.Streak class="text-center font-medium tabular-nums" />
{/snippet}
{#snippet playerRowWrapper({ row, children }: { row: MatchHistoryPlayer; children: Snippet })}
	<Player.Root player={toLobbyPlayer(row, 0)} playerResult={row} race={row.race_id}>
		{@render children()}
	</Player.Root>
{/snippet}

{#if visibleMatches.length === 0}
	<p class={cn('text-secondary-400 px-4 py-3 text-sm', className)}>
		{t('No recent matches found.')}
	</p>
{:else}
	<div class={className}>
		{#each visibleMatches as match (match.id)}
			{@const players = sortBy(match.players, ['teamid'])}
			{@const savedId = savedBySession.current?.get(match.id)}
			{@const isManuallyHidden = filters.current?.sessionIds.has(match.id) ?? false}
			{@const isHidden = isHiddenFromPublic(
				match.id,
				match.description,
				filters.current?.sessionIds,
				filters.current?.keywords
			)}
			<section class="border-secondary-800 border-b">
				<div class="border-secondary-800 flex items-center gap-4 border-b px-4 py-2">
					<MapImage small map={match.mapname} alt={normalizeMapName(match.mapname)} />
					<div class="min-w-0 grow">
						<h3 class="font-heading truncate text-lg font-bold">
							{normalizeMapName(match.mapname)}
						</h3>
						<p class="text-secondary-400 text-sm">
							{dayjs.unix(match.startgametime).format('MMM D, YYYY · HH:mm')}
							{#if showSessionId}
								<span class="text-secondary-500 text-xs tabular-nums">
									· {t('ID: {id}', { id: match.id })}</span
								>
							{/if}
						</p>
					</div>
					<div class="flex shrink-0 items-center gap-4">
						{#if isStaff && isHidden}
							<Badge variant="warning">{t('Hidden')}</Badge>
						{/if}
						{#if isStaff}
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								loading={pendingSessionId === match.id}
								onclick={() => toggleHidden(match.id, isManuallyHidden)}
								aria-label={isManuallyHidden ? t('Show match') : t('Hide match')}
								{@attach tooltip(isManuallyHidden ? t('Show match') : t('Hide match'))}
							>
								{#if isManuallyHidden}
									<EyeIcon class="size-4" />
								{:else}
									<EyeSlashIcon class="size-4" />
								{/if}
							</Button>
						{/if}
						{#if savedId}
							<Button href="/history/{savedId}" size="sm" variant="secondary">
								<ChecksIcon class="size-4 text-green-400" {@attach tooltip(t('Result saved'))} />
								{t('View match')}
							</Button>
						{/if}
						<span class="text-secondary-300 flex items-center gap-2 text-sm font-medium">
							<ClockIcon class="size-4" />
							{matchDuration(match)}
						</span>
					</div>
				</div>
				<DataTable
					data={players}
					{columns}
					rowKey={(player) => player.profile_id}
					rowClass={getPlayerRowClass}
					rowWrapper={playerRowWrapper}
					density="compact"
					striped={false}
					class="rounded-none border-0"
					cells={{
						change: cell_change,
						elo: cell_elo,
						rank: cell_rank,
						team: cell_team,
						player: cell_player,
						wins: cell_wins,
						losses: cell_losses,
						streak: cell_streak
					}}
				/>
			</section>
		{/each}
	</div>
{/if}
