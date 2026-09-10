<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		formatStreak,
		interactive,
		statLosses,
		statStreakClass,
		statWins,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import PlayerLabels from '../player/player-labels.svelte';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import type { LeaderboardStatRow, PlayerEloMap } from '../format/types';
	import {
		formatRatio,
		getEloColor,
		getEloTextShadow,
		getRatioColor,
		getStoredEloForLeaderboard,
		isEliteElo
	} from '../format/player-format';

	type Props = {
		stats: LeaderboardStatRow[];
		eloBySteamId: Record<string, PlayerEloMap>;
		getSteamIdFromName: (name: string) => string;
		getCountryDisplayName: (country: string | null | undefined) => string | null;
		getRankImageByLeaderboardId: (leaderboardId: number, rankLevel: number) => string;
		flagImageUrl: (country: string | null | undefined) => string | null;
		playerHref: (profileId: number) => string;
		emptyMessage?: string;
		rankColumnLabel?: string;
		aliasColumnLabel?: string;
		eloColumnLabel?: string;
		winsColumnLabel?: string;
		lossesColumnLabel?: string;
		streakColumnLabel?: string;
		ratioColumnLabel?: string;
		naLabel?: string;
	};

	let {
		stats,
		eloBySteamId,
		getSteamIdFromName,
		getCountryDisplayName,
		getRankImageByLeaderboardId,
		flagImageUrl,
		playerHref,
		emptyMessage = 'No players found.',
		rankColumnLabel = 'Rank',
		aliasColumnLabel = 'Alias',
		eloColumnLabel = 'ELO',
		winsColumnLabel = 'Wins',
		lossesColumnLabel = 'Losses',
		streakColumnLabel = 'Streak',
		ratioColumnLabel = 'Ratio',
		naLabel = 'N/A'
	}: Props = $props();

	function eloForRow(stat: LeaderboardStatRow): number | null {
		return getStoredEloForLeaderboard(
			eloBySteamId[getSteamIdFromName(stat.profile.name)],
			stat.leaderboard_id
		);
	}
</script>

{#if stats.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{emptyMessage}</p>
{:else}
	<div class="hidden overflow-x-auto md:block">
		<table class="w-full table-fixed border-collapse text-sm">
			<thead>
				<tr class="{tableHeadRow} text-center">
					<th class="w-14 px-4 py-2">#</th>
					<th class="w-26 px-4 py-2">{rankColumnLabel}</th>
					<th class="px-4 py-2 text-left">{aliasColumnLabel}</th>
					<th class="w-22 px-4 py-2">{eloColumnLabel}</th>
					<th class="w-20 px-4 py-2">{winsColumnLabel}</th>
					<th class="w-22 px-4 py-2">{lossesColumnLabel}</th>
					<th class="w-22 px-4 py-2">{streakColumnLabel}</th>
					<th class="w-22 px-4 py-2">{ratioColumnLabel}</th>
				</tr>
			</thead>
			<tbody>
				{#each stats as stat (stat.profile.profile_id)}
					{@const elo = eloForRow(stat)}
					{@const countryName = getCountryDisplayName(stat.profile.country)}
					{@const flagUrl = flagImageUrl(stat.profile.country)}
					<tr class="border-secondary-800/70 hover:bg-secondary-950/50 h-11 border-t text-white">
						<td class="text-secondary-400 px-4 py-1.5 text-center font-semibold tabular-nums">
							{stat.rank}
						</td>
						<td class="px-4 py-1.5">
							<div class="flex items-center justify-center gap-2">
								<img
									src={getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel)}
									alt=""
									class="size-6 shrink-0 object-contain"
								/>
								<span class="text-secondary-400 text-sm tabular-nums">{stat.ranklevel}</span>
							</div>
						</td>
						<td class="px-4 py-1.5">
							<a
								href={playerHref(stat.profile.profile_id)}
								class={cn(
									interactive,
									'flex min-w-0 items-center gap-2 font-medium hover:text-primary'
								)}
							>
								{#if flagUrl}
									<img
										class="h-4 w-auto shrink-0 rounded-xs"
										src={flagUrl}
										alt={countryName ?? stat.profile.country ?? ''}
										title={countryName ?? undefined}
									/>
								{/if}
								<PlayerLikeCount likeCount={stat.profile.likeCount} class="shrink-0" />
								<span class="truncate">{stat.profile.alias}</span>
								<PlayerLabels labels={stat.profile.labels} class="shrink-0" />
							</a>
						</td>
						<td
							class={cn(
								'px-4 py-1.5 text-center tabular-nums',
								elo == null && 'text-secondary-500 text-xs font-normal',
								isEliteElo(elo) && 'font-bold tracking-wide'
							)}
							style:color={elo != null ? getEloColor(elo) : undefined}
							style:text-shadow={getEloTextShadow(elo)}
						>
							{elo ?? naLabel}
						</td>
						<td class={cn('px-4 py-1.5 text-center font-medium', statWins)}>{stat.wins}</td>
						<td class={cn('px-4 py-1.5 text-center font-medium', statLosses)}>{stat.losses}</td>
						<td class={cn('px-4 py-1.5 text-center font-medium', statStreakClass(stat.streak))}>
							{formatStreak(stat.streak)}
						</td>
						<td
							class="px-4 py-1.5 text-center font-medium tabular-nums"
							style:color={getRatioColor(stat.wins, stat.losses)}
						>
							{formatRatio(stat.wins, stat.losses)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="divide-secondary-800 divide-y md:hidden">
		{#each stats as stat (stat.profile.profile_id)}
			{@const elo = eloForRow(stat)}
			{@const countryName = getCountryDisplayName(stat.profile.country)}
			{@const flagUrl = flagImageUrl(stat.profile.country)}
			<div class="px-4 py-3 text-white">
				<div class="flex items-center gap-2">
					<span class="text-secondary-400 shrink-0 font-semibold tabular-nums">#{stat.rank}</span>
					<div class="flex shrink-0 items-center gap-1.5">
						<img
							src={getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel)}
							alt=""
							class="size-6 shrink-0 object-contain"
						/>
						<span class="text-secondary-400 text-sm tabular-nums">{stat.ranklevel}</span>
					</div>
					<a
						href={playerHref(stat.profile.profile_id)}
						class={cn(
							interactive,
							'flex min-w-0 flex-1 items-center gap-2 font-medium hover:text-primary'
						)}
					>
						{#if flagUrl}
							<img
								class="h-4 w-auto shrink-0 rounded-xs"
								src={flagUrl}
								alt={countryName ?? stat.profile.country ?? ''}
								title={countryName ?? undefined}
							/>
						{/if}
						<PlayerLikeCount likeCount={stat.profile.likeCount} class="shrink-0" />
						<span class="truncate">{stat.profile.alias}</span>
						<PlayerLabels labels={stat.profile.labels} class="shrink-0" />
					</a>
					<span
						class={cn(
							'shrink-0 tabular-nums',
							elo == null && 'text-secondary-500 text-xs font-normal',
							isEliteElo(elo) && 'font-bold tracking-wide'
						)}
						style:color={elo != null ? getEloColor(elo) : undefined}
						style:text-shadow={getEloTextShadow(elo)}
					>
						{elo ?? naLabel}
					</span>
				</div>
				<div class="text-secondary-400 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
					<span>
						{winsColumnLabel} <span class={cn('font-medium', statWins)}>{stat.wins}</span>
					</span>
					<span>
						{lossesColumnLabel} <span class={cn('font-medium', statLosses)}>{stat.losses}</span>
					</span>
					<span>
						{streakColumnLabel}
						<span class={cn('font-medium', statStreakClass(stat.streak))}>
							{formatStreak(stat.streak)}
						</span>
					</span>
					<span>
						{ratioColumnLabel}
						<span
							class="font-medium tabular-nums"
							style:color={getRatioColor(stat.wins, stat.losses)}
						>
							{formatRatio(stat.wins, stat.losses)}
						</span>
					</span>
				</div>
			</div>
		{/each}
	</div>
{/if}
