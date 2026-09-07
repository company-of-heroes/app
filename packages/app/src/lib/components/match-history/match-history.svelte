<script lang="ts">
	import type { LobbyPlayer, MatchHistoryPlayer, TransformedMatch } from '@fknoobs/app';
	import type { Snippet } from 'svelte';
	import dayjs from '$lib/dayjs';
	import { interactive } from '$lib/components/ui/variants';
	import { cn, normalizeMapName } from '$lib/utils';
	import * as Player from '$lib/components/player';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { orderBy, sortBy } from 'lodash-es';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { app } from '$core/app/context';
	import { tooltip } from '$lib/attachments';
	import { resource } from 'runed';
	import { useI18n } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		hideMatch,
		isHiddenFromPublic,
		listHiddenKeywordWords,
		listHiddenSessionIds,
		titleMatchesHiddenKeyword,
		unhideMatch
	} from '$core/pocketbase/hidden-matches';

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
	const hiddenIds = resource(
		() => true,
		() => listHiddenSessionIds()
	);
	const hiddenWords = resource(
		() => true,
		() => listHiddenKeywordWords()
	);
	const visibleMatches = $derived.by(() => {
		if (isStaff) return orderedMatches;
		if (hiddenIds.current == null || hiddenWords.current == null || hiddenIds.error || hiddenWords.error) {
			return [];
		}

		const ids = hiddenIds.current;
		const words = hiddenWords.current;
		return orderedMatches.filter(
			(match) => !ids.has(match.id) && !titleMatchesHiddenKeyword(match.description, words)
		);
	});
	const sessionIdsKey = $derived(orderedMatches.map((match) => match.id).join(','));
	const savedBySession = resource(
		() => sessionIdsKey,
		(key) => {
			if (!key) return Promise.resolve(new Map<number, string>());
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
			width: 'w-3/24',
			headerClass: 'text-center',
			class: 'flex w-full justify-center'
		},
		{
			id: 'team',
			header: t('Team'),
			width: 'w-2/24',
			headerClass: 'text-center',
			class: 'flex w-full justify-center'
		},
		{
			id: 'elo',
			header: t('ELO'),
			width: 'w-2/24',
			headerClass: 'text-center',
			class: 'flex w-full justify-center'
		},
		{
			id: 'player',
			header: t('Player'),
			width: 'w-9/24',
			class: 'flex min-w-0 items-center gap-2'
		},
		{
			id: 'wins',
			header: t('Wins'),
			width: 'w-2/24',
			headerClass: 'text-center',
			class: 'flex w-full justify-center'
		},
		{
			id: 'losses',
			header: t('Losses'),
			width: 'w-3/24',
			headerClass: 'text-center',
			class: 'flex w-full justify-center'
		},
		{
			id: 'streak',
			header: t('Streak'),
			width: 'w-3/24',
			headerClass: 'text-center',
			class: 'flex w-full justify-center'
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
		const confirmed = await confirm(
			currentlyHidden
				? t('Show this match on public overviews again?')
				: t('Hide this match from public overviews?'),
			{
				okLabel: currentlyHidden ? t('Show') : t('Hide'),
				cancelLabel: t('Cancel'),
				kind: 'warning'
			}
		);
		if (!confirmed) return;
		pendingSessionId = sessionId;
		try {
			if (currentlyHidden) {
				await unhideMatch(sessionId);
				app.toast.success(t('Match is visible again.'));
			} else {
				await hideMatch(sessionId, app.account.userId);
				app.toast.success(t('Match hidden from public overviews.'));
			}
			const next = new Set(hiddenIds.current ?? []);
			if (currentlyHidden) {
				next.delete(sessionId);
			} else {
				next.add(sessionId);
			}
			hiddenIds.mutate(next);
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
	<p class={cn('text-secondary-400 px-4 py-3 text-sm', className)}>{t('No recent matches found.')}</p>
{:else}
	<div class={className}>
		{#each visibleMatches as match (match.id)}
			{@const players = sortBy(match.players, ['teamid'])}
			{@const savedId = savedBySession.current?.get(match.id)}
			{@const isManuallyHidden = hiddenIds.current?.has(match.id) ?? false}
			{@const isHidden = isHiddenFromPublic(
				match.id,
				match.description,
				hiddenIds.current,
				hiddenWords.current
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
								<span class="text-secondary-500 text-xs tabular-nums"> · {t('ID: {id}', { id: match.id })}</span>
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
								title={isManuallyHidden ? t('Show match') : t('Hide match')}
							>
								{#if isManuallyHidden}
									<EyeIcon class="size-4" />
								{:else}
									<EyeSlashIcon class="size-4" />
								{/if}
							</Button>
						{/if}
						{#if savedId}
							<a
								href="/history/{savedId}"
								class={cn(
									interactive,
									'text-primary inline-flex items-center gap-1.5 text-sm whitespace-nowrap hover:underline'
								)}
							>
								<ChecksIcon class="size-4 text-green-400" {@attach tooltip(t('Result saved'))} />
								{t('View details')}
							</a>
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
						team: cell_team,
						elo: cell_elo,
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
