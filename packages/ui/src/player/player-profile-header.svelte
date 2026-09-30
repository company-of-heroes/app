<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, statLosses, statWins } from '@company-of-heroes/ui/variants';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import { formatDate } from '../format/date';
	import {
		getModeLabel,
		getRaceLabel,
		getRatioColor,
		getRatioValue,
		normalizeMapName,
		winrate
	} from '../format/player-format';
	import { useHost } from '../host/host.context';
	import LeaderboardStatPill from '../leaderboard/leaderboard-stat-pill.svelte';
	import LikeButton from '../comment/like-button.svelte';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import * as List from '../ui/list';
	import type { PlayerPageData } from './types';
	import PlayerCompanionStaffDebug from './player-companion-staff-debug.svelte';
	import PlayerLabels from './player-labels.svelte';
	import RewardIcons from '../reward/reward-icons.svelte';
	import PlayerStreamerIcon from './player-streamer-icon.svelte';
	import { isStreamingLink } from './profile';
	import SmurfAlert from './smurf-alert.svelte';
	import TwitchLogo from './twitch-logo.svelte';
	import YoutubeLogo from './youtube-logo.svelte';

	type Props = {
		player: PlayerPageData;
		/** Host-only extras shown in the action row above the name (e.g. label editor, cheater alert). */
		actions?: Snippet;
		afterName?: Snippet;
	};

	let { player, actions, afterName }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const isSelf = $derived(host.auth.isSelf(player.steamId, player.profileId));
	const joinedSince = $derived(
		player.timecreated ? formatDate(player.timecreated, host.locale()) : null
	);
	const emptyTrackedLabel = $derived(
		isSelf
			? t('Play with the companion running to build stats.')
			: t('No tracked community matches for this player.')
	);
	const flag = $derived(host.resolve.flagImageUrl(player.country));

	const stats = $derived(player.performance);
	const recentMatches = $derived((stats?.recentMatches ?? []).slice(0, 5));
	const bestMap = $derived.by(() => {
		if (!stats) {
			return null;
		}

		const eligible = stats.byMap.filter((map) => map.wins + map.losses >= 3);
		const pool = eligible.length > 0 ? eligible : stats.byMap;
		return (
			[...pool].sort(
				(a, b) => getRatioValue(b.wins, b.losses) - getRatioValue(a.wins, a.losses)
			)[0] ?? null
		);
	});

	const avatarBorder = $derived(
		player.gameextrainfo?.trim() === 'Company of Heroes'
			? 'border-green-500'
			: player.personastate > 0
				? 'border-blue-400'
				: 'border-secondary-800'
	);

	const hasBackground = $derived(Boolean(player.customization?.backgroundUrl));
	const bio = $derived.by(() => {
		const value = player.customization?.bio?.trim();
		return value ? value : null;
	});
	const streamingLinks = $derived((player.customization?.links ?? []).filter(isStreamingLink));
	const otherLinks = $derived(
		(player.customization?.links ?? []).filter((link) => !isStreamingLink(link))
	);

	const metaList = 'grid-cols-[9.5rem_minmax(0,1fr)] content-start gap-x-4';
	const valueRow = 'inline-flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap';
	const recentMatchBase =
		'min-w-6 px-1.5 py-0.5 text-center font-semibold transition-colors duration-150';
	const recentMatchWin =
		'border-success/15 bg-success/5 text-success/45 group-hover:border-success/50 group-hover:bg-success/25 group-hover:text-green-300 group-focus-visible:border-success/50 group-focus-visible:bg-success/25 group-focus-visible:text-green-300';
	const recentMatchLoss =
		'border-destructive/15 bg-destructive/5 text-destructive/45 group-hover:border-destructive/50 group-hover:bg-destructive/25 group-hover:text-red-300 group-focus-visible:border-destructive/50 group-focus-visible:bg-destructive/25 group-focus-visible:text-red-300';
</script>

<div class="relative overflow-clip">
	{#if hasBackground}
		<img
			src={player.customization!.backgroundUrl!}
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
		/>
		<div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/75 to-black/60"></div>
	{/if}
	<div
		class={cn(
			'border-secondary-800 relative z-10 grid grid-cols-1 gap-4 border-b sm:grid-cols-[minmax(220px,280px)_auto_minmax(0,1fr)]'
		)}
	>
		<div class={cn('aspect-square self-start overflow-clip', 'border-r border-b', avatarBorder)}>
			<img
				src={host.resolve.avatarUrl(player.avatarUrl)}
				alt={player.alias}
				class="h-full w-full object-cover"
			/>
		</div>
		<div class="flex items-start justify-center px-6 sm:px-0 sm:py-4">
			<LikeButton
				target={{ kind: 'player', id: player.steamId }}
				likeCount={player.likeCount ?? 0}
			/>
		</div>
		<div class="min-w-0">
			<div class="px-6 py-4 sm:pl-0">
				{#if actions || isSelf}
					<div class="mb-3 flex flex-wrap items-center gap-2">
						{@render actions?.()}
						{#if isSelf}
							<Button
								href={host.routes.accountProfile(player.steamId)}
								variant="secondary"
								size="sm"
								class="shrink-0"
							>
								<PencilSimpleIcon size={16} />
								{t('Update profile')}
							</Button>
						{/if}
					</div>
				{/if}
				<div class="mb-3 flex flex-wrap items-center gap-2.5">
					{#if flag}
						<img class="h-5 w-auto shrink-0 rounded-xs" src={flag} alt={player.country ?? ''} />
					{/if}
					<PlayerStreamerIcon labels={player.labels} steamId={player.steamId} size={24} />
					<h1 class="font-heading truncate text-3xl font-bold">{player.alias}</h1>
					<PlayerLabels labels={player.labels} class="shrink-0" />
					<span class="text-secondary-500 text-sm">
						{t('Level {level}', { level: player.level })}
					</span>
					{@render afterName?.()}
				</div>
				{#if streamingLinks.length > 0}
					<div class="mb-3 flex flex-wrap items-center gap-4">
						{#each streamingLinks as link (link.url)}
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								class={cn(
									interactive,
									'inline-flex items-center gap-2 text-sm font-medium underline'
								)}
							>
								{#if link.type === 'twitch'}
									<TwitchLogo size={20} class="text-[#9146FF]" />
									<span>Twitch</span>
								{:else}
									<YoutubeLogo size={20} />
									<span>YouTube</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
				{#if bio || otherLinks.length > 0}
					<div class="my-4">
						{#if bio}
							<p class="text-secondary-200 mb-3 max-w-2xl whitespace-pre-wrap">{bio}</p>
						{/if}
						{#if otherLinks.length > 0}
							<div class="mb-3 flex flex-wrap items-center gap-4">
								{#each otherLinks as link (link.url)}
									<a
										href={link.url}
										target="_blank"
										rel="noopener noreferrer"
										class={cn(
											interactive,
											'text-secondary-300 hover:text-primary inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm transition-colors'
										)}
									>
										<LinkIcon size={18} />
										{#if link.label}
											<span>{link.label}</span>
										{/if}
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				<RewardIcons steamId={player.steamId} />
				<div class="grid grid-cols-1 items-start gap-x-6 gap-y-1 sm:grid-cols-2">
					<List.Root class={metaList}>
						<List.Title>{t('Steam ID:')}</List.Title>
						<List.Value>
							<a
								href="https://steamcommunity.com/profiles/{player.steamId}"
								target="_blank"
								rel="noopener noreferrer"
								class={cn(interactive, 'hover:text-primary tabular-nums transition-colors')}
							>
								{player.steamId}
							</a>
						</List.Value>
						<List.Title>{t('Joined since:')}</List.Title>
						<List.Value>{joinedSince ?? '—'}</List.Value>
						{#if player.smurf}
							<List.Title class="flex h-5 items-center leading-none"
								>{t('Smurf account:')}</List.Title
							>
							<List.Value class="flex h-5 items-center leading-none">
								<SmurfAlert smurf={player.smurf} showLabel={false} />
							</List.Value>
						{/if}
					</List.Root>
					<List.Root class={metaList}>
						{#if stats && stats.matchCount > 0}
							<List.Title>{t('Record:')}</List.Title>
							<List.Value class={valueRow}>
								<span class={statWins}>{stats.wins}W</span>
								<span class="text-secondary-600">·</span>
								<span class={statLosses}>{stats.losses}L</span>
								<LeaderboardStatPill
									type="ratio"
									wins={stats.wins}
									losses={stats.losses}
									streak={0}
								/>
							</List.Value>
							{#if recentMatches.length > 0}
								<List.Title>{t('Recent:')}</List.Title>
								<List.Value
									class="inline-flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto"
								>
									{#each recentMatches as match (match.id || match.sessionId)}
										{@const href = match.id ? host.routes.match(match.id) : null}
										{@const title = `${match.outcome === 1 ? t('Win') : t('Loss')}${match.raceId != null ? ` · ${getRaceLabel(match.raceId)}` : ''}${match.matchtypeId != null ? ` · ${getModeLabel(match.matchtypeId)}` : ''}`}
										{#if href}
											<a {href} class={cn(interactive, 'group inline-flex shrink-0')} {title}>
												<Badge
													variant={match.outcome === 1 ? 'success' : 'destructive'}
													class={cn(
														recentMatchBase,
														match.outcome === 1 ? recentMatchWin : recentMatchLoss
													)}
												>
													{match.outcome === 1 ? 'W' : 'L'}
												</Badge>
											</a>
										{:else}
											<span class="inline-flex shrink-0" {title}>
												<Badge
													variant={match.outcome === 1 ? 'success' : 'destructive'}
													class={cn(
														recentMatchBase,
														match.outcome === 1 ? recentMatchWin : recentMatchLoss
													)}
												>
													{match.outcome === 1 ? 'W' : 'L'}
												</Badge>
											</span>
										{/if}
									{/each}
								</List.Value>
							{/if}
							{#if bestMap}
								<List.Title>{t('Best map:')}</List.Title>
								<List.Value class={valueRow}>
									<span class="text-secondary-300 max-w-44 truncate">
										{normalizeMapName(bestMap.map, false)}
									</span>
									<span class={statWins}>{bestMap.wins}W</span>
									<span class="text-secondary-600">·</span>
									<span class={statLosses}>{bestMap.losses}L</span>
									<span
										class="font-medium"
										style:color={getRatioColor(bestMap.wins, bestMap.losses)}
									>
										{winrate(bestMap.wins, bestMap.losses)}
									</span>
								</List.Value>
							{/if}
						{:else}
							<List.Title>{t('Tracked:')}</List.Title>
							<List.Value class="text-secondary-400 text-sm">{emptyTrackedLabel}</List.Value>
						{/if}
					</List.Root>
				</div>
			</div>
			<PlayerCompanionStaffDebug steamId={player.steamId} />
		</div>
	</div>
</div>
