<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, statLosses, statWins, tableHeadRow } from '@company-of-heroes/ui/variants';
	import {
		getEloColor,
		getEloTextShadow,
		getModeLabel,
		getRaceLabel,
		getRatioColor,
		getStoredEloForLeaderboard,
		isEliteElo,
		isRankedLeaderboard,
		normalizeMapName,
		sortLeaderboardStats,
		winrate
	} from '../format/player-format';
	import { getLeaderboardTypeLabel } from '../format/ranks';
	import LeaderboardStatPill from '../leaderboard/leaderboard-stat-pill.svelte';
	import MapImage from '../ui/map-image.svelte';
	import type { PlayerCompareData, PlayerCompareSide } from './types';

	type Props = {
		data: PlayerCompareData;
		flagImageUrl: (country: string | null | undefined) => string | null;
		resolveAvatarUrl: (url: string) => string;
		playerHref: (profileId: number, steamId: string) => string;
		matchHref?: (lobbyId: string, sessionId: number) => string | null;
		resolveMapSrc?: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (raceId: number) => string;
		getRankImageByLeaderboardId: (leaderboardId: number, rankLevel: number) => string;
		getFactionFlagByLeaderboardId: (leaderboardId: number) => string;
		headToHeadLabel?: string;
		trackedLabel?: string;
		togetherLabel?: string;
		ladderLabel?: string;
		performanceLabel?: string;
		byModeLabel?: string;
		byMapLabel?: string;
		recentLabel?: string;
		gamesLabel?: string;
		mapLabel?: string;
		modeLabel?: string;
		emptyH2hLabel?: string;
		emptyLadderLabel?: string;
		emptyPerformanceLabel?: string;
		factionsLabel?: string;
		leftWinLabel?: string;
		rightWinLabel?: string;
		viewMatchLabel?: string;
	};

	let {
		data,
		flagImageUrl,
		resolveAvatarUrl,
		playerHref,
		matchHref,
		resolveMapSrc,
		resolveFallbackSrc,
		resolveFactionFlag,
		getRankImageByLeaderboardId,
		getFactionFlagByLeaderboardId,
		headToHeadLabel = 'Head to head',
		trackedLabel = 'Tracked community matches',
		togetherLabel = 'Played together as teammates',
		ladderLabel = 'Ladder stats',
		performanceLabel = 'Community performance',
		byModeLabel = 'By mode',
		byMapLabel = 'By map',
		recentLabel = 'Recent matchups',
		gamesLabel = 'Games',
		mapLabel = 'Map',
		modeLabel = 'Mode',
		emptyH2hLabel = 'No tracked games against each other yet.',
		emptyLadderLabel = 'No leaderboard stats yet.',
		emptyPerformanceLabel = 'No tracked community matches for this player.',
		factionsLabel = 'Factions',
		leftWinLabel = '{alias} win',
		rightWinLabel = '{alias} win',
		viewMatchLabel = 'View match'
	}: Props = $props();

	const left = $derived(data.left);
	const right = $derived(data.right);
	const h2h = $derived(data.h2h);
	const leftStats = $derived(sortLeaderboardStats(left.leaderboardStats));
	const rightStats = $derived(sortLeaderboardStats(right.leaderboardStats));
	const leftModes = $derived(left.performance.byMode.filter((row) => row.matchtypeId !== 14));
	const rightModes = $derived(right.performance.byMode.filter((row) => row.matchtypeId !== 14));
	const h2hModes = $derived(h2h.byMode.filter((row) => row.matchtypeId !== 14));
</script>

{#snippet playerCard(side: PlayerCompareSide)}
	<a
		href={playerHref(side.profileId, side.steamId)}
		class={cn(interactive, 'flex min-w-0 items-center gap-3 transition-colors')}
	>
		<img
			src={resolveAvatarUrl(side.avatarUrl)}
			alt={side.alias}
			class="size-14 shrink-0 rounded-xl border-2 border-secondary-700 object-cover"
		/>
		<div class="min-w-0">
			<div class="flex min-w-0 items-center gap-2">
				{#if flagImageUrl(side.country)}
					<img
						class="h-4 w-auto shrink-0 rounded-xs"
						src={flagImageUrl(side.country)!}
						alt={side.country ?? ''}
					/>
				{/if}
				<span class="font-heading truncate text-xl font-bold text-white hover:text-primary">
					{side.alias}
				</span>
			</div>
			<p class="text-secondary-500 mt-0.5 text-xs tabular-nums">
				Lv {side.level} · {side.profileId}
			</p>
			{#if side.performance.matchCount > 0}
				<p class="mt-1 flex items-center gap-1.5 text-sm">
					<span class={statWins}>{side.performance.wins}W</span>
					<span class="text-secondary-600">·</span>
					<span class={statLosses}>{side.performance.losses}L</span>
					<LeaderboardStatPill
						type="ratio"
						wins={side.performance.wins}
						losses={side.performance.losses}
					/>
				</p>
			{/if}
		</div>
	</a>
{/snippet}

{#snippet ladderColumn(side: PlayerCompareSide, stats: typeof leftStats)}
	{#if stats.length === 0}
		<p class="text-secondary-400 px-3 py-2 text-sm">{emptyLadderLabel}</p>
	{:else}
		<ul class="divide-secondary-800 divide-y">
			{#each stats as stat (stat.leaderboard_id)}
				{@const elo = getStoredEloForLeaderboard(side.elo, stat.leaderboard_id)}
				<li class="flex items-center gap-2 px-3 py-2 text-sm">
					<img
						src={getFactionFlagByLeaderboardId(stat.leaderboard_id)}
						alt=""
						class="h-4 w-auto shrink-0"
					/>
					<img
						src={getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel)}
						alt=""
						class="h-5 w-auto shrink-0"
					/>
					<span class="text-secondary-300 min-w-0 flex-1 truncate text-xs">
						{getLeaderboardTypeLabel(stat.leaderboard_id)}
					</span>
					{#if elo != null}
						<span
							class={cn('tabular-nums text-sm font-semibold', isEliteElo(elo) && 'font-bold')}
							style:color={getEloColor(elo)}
							style:text-shadow={getEloTextShadow(elo)}
						>
							{elo}
						</span>
					{:else}
						<span class="text-secondary-500 text-xs">—</span>
					{/if}
					<span class={cn(statWins, 'tabular-nums text-xs')}>{stat.wins}</span>
					<span class={cn(statLosses, 'tabular-nums text-xs')}>{stat.losses}</span>
					{#if isRankedLeaderboard(stat.leaderboard_id) && stat.rank > 0}
						<span class="text-secondary-500 w-8 text-right text-xs tabular-nums">#{stat.rank}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet performanceSummary(side: PlayerCompareSide, modes: Array<{ matchtypeId: number; wins: number; losses: number }>)}
	{#if side.performance.matchCount === 0}
		<p class="text-secondary-400 px-3 py-2 text-sm">{emptyPerformanceLabel}</p>
	{:else}
		<div class="space-y-3 px-3 py-2">
			<p class="flex flex-wrap items-center gap-2 text-sm">
				<span class={statWins}>{side.performance.wins}W</span>
				<span class="text-secondary-600">·</span>
				<span class={statLosses}>{side.performance.losses}L</span>
				<span class="text-secondary-500 text-xs">
					{side.performance.matchCount} {gamesLabel.toLowerCase()}
				</span>
				<span class={cn('text-sm font-semibold', getRatioColor(side.performance.wins, side.performance.losses))}>
					{winrate(side.performance.wins, side.performance.losses)}%
				</span>
			</p>
			<div>
				<p class="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">{byModeLabel}</p>
				<ul class="space-y-1">
					{#each modes.slice(0, 6) as row (row.matchtypeId)}
						<li class="flex items-center justify-between gap-2 text-xs">
							<span class="text-secondary-300">{getModeLabel(row.matchtypeId)}</span>
							<span class="tabular-nums">
								<span class={statWins}>{row.wins}</span>
								<span class="text-secondary-600">–</span>
								<span class={statLosses}>{row.losses}</span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
			<div>
				<p class="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">{byMapLabel}</p>
				<ul class="space-y-1">
					{#each side.performance.byMap.slice(0, 5) as row (row.map)}
						<li class="flex items-center justify-between gap-2 text-xs">
							<span class="text-secondary-300 min-w-0 truncate">{normalizeMapName(row.map)}</span>
							<span class="tabular-nums shrink-0">
								<span class={statWins}>{row.wins}</span>
								<span class="text-secondary-600">–</span>
								<span class={statLosses}>{row.losses}</span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
			<div>
				<p class="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">{factionsLabel}</p>
				<ul class="space-y-1">
					{#each side.performance.byFaction as row (row.raceId)}
						<li class="flex items-center justify-between gap-2 text-xs">
							<span class="flex min-w-0 items-center gap-1.5">
								<img src={resolveFactionFlag(row.raceId)} alt="" class="h-3.5 w-auto" />
								<span class="text-secondary-300">{getRaceLabel(row.raceId)}</span>
							</span>
							<span class="tabular-nums">
								<span class={statWins}>{row.wins}</span>
								<span class="text-secondary-600">–</span>
								<span class={statLosses}>{row.losses}</span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
{/snippet}

<div class="border-secondary-800 overflow-clip border-b">
	<div class="border-secondary-800 grid grid-cols-1 gap-4 border-b p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
		{@render playerCard(left)}
		<div class="text-secondary-500 hidden text-center text-xs font-semibold tracking-widest uppercase sm:block">
			VS
		</div>
		{@render playerCard(right)}
	</div>

	<section class="border-secondary-800 border-b px-4 py-5">
		<div class="mb-3 flex flex-wrap items-end justify-between gap-2">
			<div>
				<h2 class="font-heading text-lg font-bold text-white">{headToHeadLabel}</h2>
				<p class="text-secondary-500 text-xs">{trackedLabel}</p>
			</div>
			{#if h2h.together > 0}
				<p class="text-secondary-400 text-xs">
					{togetherLabel}: <span class="text-secondary-200 tabular-nums">{h2h.together}</span>
				</p>
			{/if}
		</div>

		{#if h2h.played === 0}
			<p class="text-secondary-400 text-sm">{emptyH2hLabel}</p>
		{:else}
			<div class="mb-4 flex flex-wrap items-center justify-center gap-4 py-2">
				<div class="text-center">
					<p class="font-heading text-3xl font-bold tabular-nums">
						<span class={statWins}>{h2h.winsLeft}</span>
						<span class="text-secondary-600 mx-1">–</span>
						<span class={statLosses}>{h2h.winsRight}</span>
					</p>
					<p class="text-secondary-500 mt-1 text-xs">
						{h2h.played} {gamesLabel.toLowerCase()} · {winrate(h2h.winsLeft, h2h.winsRight)}% / {winrate(h2h.winsRight, h2h.winsLeft)}%
					</p>
				</div>
			</div>

			{#if h2hModes.length > 0}
				<div class="mb-4">
					<p class="text-secondary-500 mb-2 text-xs font-semibold tracking-wide uppercase">{byModeLabel}</p>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class={tableHeadRow}>
									<th class="px-2 py-1.5 text-left">{modeLabel}</th>
									<th class="px-2 py-1.5 text-center">{gamesLabel}</th>
									<th class="px-2 py-1.5 text-center">{left.alias}</th>
									<th class="px-2 py-1.5 text-center">{right.alias}</th>
								</tr>
							</thead>
							<tbody>
								{#each h2hModes as row (row.matchtypeId)}
									<tr class="border-secondary-800 border-b">
										<td class="text-secondary-300 px-2 py-1.5">{getModeLabel(row.matchtypeId)}</td>
										<td class="px-2 py-1.5 text-center tabular-nums">{row.played}</td>
										<td class={cn(statWins, 'px-2 py-1.5 text-center tabular-nums')}>{row.winsLeft}</td>
										<td class={cn(statLosses, 'px-2 py-1.5 text-center tabular-nums')}>{row.winsRight}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if h2h.byMap.length > 0}
				<div class="mb-4">
					<p class="text-secondary-500 mb-2 text-xs font-semibold tracking-wide uppercase">{byMapLabel}</p>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class={tableHeadRow}>
									<th class="px-2 py-1.5 text-left">{mapLabel}</th>
									<th class="px-2 py-1.5 text-center">{gamesLabel}</th>
									<th class="px-2 py-1.5 text-center">{left.alias}</th>
									<th class="px-2 py-1.5 text-center">{right.alias}</th>
								</tr>
							</thead>
							<tbody>
								{#each h2h.byMap as row (row.map)}
									<tr class="border-secondary-800 border-b">
										<td class="text-secondary-300 px-2 py-1.5">
											<div class="flex min-w-0 items-center gap-2">
												{#if resolveMapSrc}
													<div class="size-8 shrink-0 overflow-clip rounded">
														<MapImage
															map={row.map}
															alt={normalizeMapName(row.map)}
															flush
															{resolveMapSrc}
															{resolveFallbackSrc}
														/>
													</div>
												{/if}
												<span class="min-w-0 truncate">{normalizeMapName(row.map)}</span>
											</div>
										</td>
										<td class="px-2 py-1.5 text-center tabular-nums">{row.played}</td>
										<td class={cn(statWins, 'px-2 py-1.5 text-center tabular-nums')}>{row.winsLeft}</td>
										<td class={cn(statLosses, 'px-2 py-1.5 text-center tabular-nums')}>{row.winsRight}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if h2h.recent.length > 0}
				<div>
					<p class="text-secondary-500 mb-2 text-xs font-semibold tracking-wide uppercase">{recentLabel}</p>
					<ul class="divide-secondary-800 divide-y">
						{#each h2h.recent as match (match.lobbyId || `${match.sessionId}:${match.map}`)}
							{@const href = matchHref?.(match.lobbyId, match.sessionId) ?? null}
							<li class="flex items-center justify-between gap-3 py-2 text-sm">
								<div class="flex min-w-0 items-center gap-2">
									{#if resolveMapSrc}
										<div class="size-9 shrink-0 overflow-clip rounded">
											<MapImage
												map={match.map}
												alt={normalizeMapName(match.map)}
												flush
												{resolveMapSrc}
												{resolveFallbackSrc}
											/>
										</div>
									{/if}
									<div class="min-w-0">
										<p class="text-secondary-200 truncate">{normalizeMapName(match.map)}</p>
										<p class="text-secondary-500 text-xs">{getModeLabel(match.matchtypeId)}</p>
									</div>
								</div>
								<div class="flex shrink-0 items-center gap-3">
									<span class="text-xs">
										{#if match.leftOutcome === 1}
											<span class={statWins}>{leftWinLabel}</span>
										{:else}
											<span class={statWins}>{rightWinLabel}</span>
										{/if}
									</span>
									{#if href}
										<a {href} class={cn(interactive, 'text-primary text-xs hover:underline')}>
											{viewMatchLabel}
										</a>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</section>

	<section class="border-secondary-800 border-b">
		<h2 class="font-heading border-secondary-800 border-b px-4 py-3 text-base font-bold text-white">
			{ladderLabel}
		</h2>
		<div class="grid grid-cols-1 md:grid-cols-2">
			<div class="border-secondary-800 md:border-r">
				<p class="text-secondary-400 border-secondary-800 truncate border-b px-3 py-2 text-xs font-semibold">
					{left.alias}
				</p>
				{@render ladderColumn(left, leftStats)}
			</div>
			<div>
				<p class="text-secondary-400 border-secondary-800 truncate border-b px-3 py-2 text-xs font-semibold">
					{right.alias}
				</p>
				{@render ladderColumn(right, rightStats)}
			</div>
		</div>
	</section>

	<section>
		<h2 class="font-heading border-secondary-800 border-b px-4 py-3 text-base font-bold text-white">
			{performanceLabel}
		</h2>
		<div class="grid grid-cols-1 md:grid-cols-2">
			<div class="border-secondary-800 md:border-r">
				<p class="text-secondary-400 border-secondary-800 truncate border-b px-3 py-2 text-xs font-semibold">
					{left.alias}
				</p>
				{@render performanceSummary(left, leftModes)}
			</div>
			<div>
				<p class="text-secondary-400 border-secondary-800 truncate border-b px-3 py-2 text-xs font-semibold">
					{right.alias}
				</p>
				{@render performanceSummary(right, rightModes)}
			</div>
		</div>
	</section>
</div>
