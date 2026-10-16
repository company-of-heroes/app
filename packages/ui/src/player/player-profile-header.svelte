<script lang="ts">
	import CountryFlag from './country-flag.svelte';
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, statLosses, statWins } from '@company-of-heroes/ui/variants';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwiseIcon';
	import IdentificationCardIcon from 'phosphor-svelte/lib/IdentificationCardIcon';
	import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifoldIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import ScalesIcon from 'phosphor-svelte/lib/ScalesIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import { formatDate } from '../format/date';
	import { getRatioColor, getRatioValue, normalizeMapName, winrate } from '../format/player-format';
	import type { HeadToHead } from '../head-to-head/types';
	import { useHost } from '../host/host.context';
	import LeaderboardStatPill from '../leaderboard/leaderboard-stat-pill.svelte';
	import LikeButton from '../comment/like-button.svelte';
	import { Button } from '../ui/button';
	import { CopyButton } from '../ui/copy-button';
	import PlayerClaimButton from './player-claim-button.svelte';
	import { Skeleton } from '../ui/skeleton';
	import type { PlayerPageData } from './types';
	import PlayerFact from './player-fact.svelte';
	import PlayerFacts from './player-facts.svelte';
	import PlayerFactsSkeleton from './player-facts-skeleton.svelte';
	import PlayerHero from './player-hero.svelte';
	import PlayerHeroSkeleton from './player-hero-skeleton.svelte';
	import PlayerCompanionStaffDebug from './player-companion-staff-debug.svelte';
	import PlayerLabels from './player-labels.svelte';
	import PlayerLinks from './player-links.svelte';
	import RewardIcons from '../reward/reward-icons.svelte';
	import MatchResultStrip from './match-result-strip.svelte';
	import PlayerStreamerIcon from './player-streamer-icon.svelte';
	import { isStreamingLink } from './profile';
	import SmurfAlert from './smurf-alert.svelte';
	import SteamBanAlert from './steam-ban-alert.svelte';

	type Props = {
		player: PlayerPageData;
		/** Host-only extras shown in the action row above the name (e.g. label editor, cheater alert). */
		actions?: Snippet;
		afterName?: Snippet;
		/** Hero data (customization, likes, rewards) still loading: shows its skeleton. */
		heroLoading?: boolean;
		/** Fact data (tracked stats, smurf check) still loading: shows its skeleton. */
		factsLoading?: boolean;
		/** Signed-in user's record against this player; `null` hides the fact. */
		headToHead?: HeadToHead | null;
		headToHeadLoading?: boolean;
		/** Shows the Compare button (signed in, not this player). */
		showCompare?: boolean;
		/** Opens the head-to-head tab. */
		onHeadToHead?: () => void;
	};

	let {
		player,
		actions: actionsSnippet,
		afterName,
		heroLoading = false,
		factsLoading = false,
		headToHead = null,
		headToHeadLoading = false,
		showCompare = false,
		onHeadToHead
	}: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const isSelf = $derived(host.auth.isSelf(player.steamId, player.profileId));
	/** No account linked this Steam id yet (rewards are loaded per linked account). */
	const unclaimed = $derived(player.rewards?.linked === false);
	const joinedSince = $derived(
		player.timecreated ? formatDate(player.timecreated, host.locale()) : null
	);
	const emptyTrackedLabel = $derived(
		isSelf
			? t('Play with the companion running to build stats.')
			: t('No tracked community matches for this player.')
	);

	const stats = $derived(player.performance);
	const recentMatches = $derived((stats?.recentMatches ?? []).slice(0, 10));
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
</script>

{#snippet headToHeadValue(record: HeadToHead)}
	{#if record.matchCount > 0}
		<span class={statWins}>{record.wins}W</span>
		<span class="text-secondary-600">·</span>
		<span class={statLosses}>{record.losses}L</span>
		<LeaderboardStatPill type="ratio" wins={record.wins} losses={record.losses} streak={0} />
	{:else}
		<span class="text-secondary-400 font-sans text-sm font-normal whitespace-normal">
			{t('No games yet')}
		</span>
	{/if}
{/snippet}

{#if heroLoading}
	<PlayerHeroSkeleton />
{:else}
	<PlayerHero backgroundUrl={player.customization?.backgroundUrl}>
		{#snippet avatar()}
			<img
				src={host.resolve.avatarUrl(player.avatarUrl)}
				alt={player.alias}
				class={cn('h-full w-full rounded-md border-2 object-cover', avatarBorder)}
			/>
		{/snippet}
		{#snippet kicker()}
			<CountryFlag country={player.country} class="h-4" />
			<PlayerStreamerIcon labels={player.labels} steamId={player.steamId} size={20} />
			<PlayerLabels labels={player.labels} class="shrink-0" />
			<span class="text-secondary-300 text-xs">
				{t('Level {level}', { level: player.level })}
			</span>
			{@render afterName?.()}
		{/snippet}
		{#snippet title()}
			<span class="truncate">{player.alias}</span>
		{/snippet}
		{#snippet beside()}
			<LikeButton
				target={{ kind: 'player', id: player.steamId }}
				likeCount={player.likeCount ?? 0}
			/>
		{/snippet}
		{#snippet actions()}
			{#if showCompare && host.routes.compare}
				<Button
					href={host.routes.compare(player.profileId)}
					variant="secondary"
					size="sm"
					class="shrink-0 bg-gray-950/60 backdrop-blur-sm"
				>
					<ScalesIcon size={16} />
					{t('Compare')}
				</Button>
			{/if}
			{@render actionsSnippet?.()}
			{#if unclaimed && !isSelf}
				<PlayerClaimButton steamId={player.steamId} />
			{/if}
			{#if isSelf}
				<Button
					href={host.routes.accountProfile(player.steamId)}
					variant="secondary"
					size="sm"
					class="shrink-0 bg-gray-950/60 backdrop-blur-sm"
				>
					<PencilSimpleIcon size={16} />
					{t('Update profile')}
				</Button>
			{/if}
		{/snippet}
		{#if player.steamBans}
			<SteamBanAlert bans={player.steamBans} />
		{/if}
		{#if streamingLinks.length > 0 || otherLinks.length > 0}
			<PlayerLinks links={[...streamingLinks, ...otherLinks]} />
		{/if}
		{#if bio}
			<p class="text-secondary-200 text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
		{/if}
		<RewardIcons steamId={player.steamId} rewards={player.rewards} class="mb-0" />
	</PlayerHero>
{/if}

{#if factsLoading}
	<PlayerFactsSkeleton />
{:else}
	<PlayerFacts>
		{#if stats && stats.matchCount > 0}
			<PlayerFact label={t('Record')} icon={TrophyIcon}>
				<span class={statWins}>{stats.wins}W</span>
				<span class="text-secondary-600">·</span>
				<span class={statLosses}>{stats.losses}L</span>
				<LeaderboardStatPill type="ratio" wins={stats.wins} losses={stats.losses} streak={0} />
			</PlayerFact>
			{#if recentMatches.length > 0}
				<PlayerFact label={t('Recent')} icon={ClockCounterClockwiseIcon}>
					<MatchResultStrip matches={recentMatches} />
				</PlayerFact>
			{/if}
			{#if bestMap}
				<PlayerFact label={t('Best map')} icon={MapTrifoldIcon}>
					<span class="truncate">{normalizeMapName(bestMap.map, false)}</span>
					{#snippet sub()}
						<span class={statWins}>{bestMap.wins}W</span>
						<span class="text-secondary-600">·</span>
						<span class={statLosses}>{bestMap.losses}L</span>
						<span class="font-medium" style:color={getRatioColor(bestMap.wins, bestMap.losses)}>
							{winrate(bestMap.wins, bestMap.losses)}
						</span>
					{/snippet}
				</PlayerFact>
			{/if}
		{:else}
			<PlayerFact label={t('Tracked')} icon={TrophyIcon}>
				<span class="text-secondary-400 font-sans text-sm font-normal whitespace-normal">
					{emptyTrackedLabel}
				</span>
			</PlayerFact>
		{/if}
		{#if headToHeadLoading || headToHead}
			<PlayerFact
				label={t('Head to head')}
				icon={SwordIcon}
				sub={!headToHeadLoading && headToHead && headToHead.matchCount > 0
					? `${t('You vs {alias}', { alias: player.alias })} · ${t('{count} games', { count: headToHead.matchCount })}`
					: null}
			>
				{#if headToHeadLoading}
					<Skeleton class="h-4 w-24" />
				{:else if headToHead && onHeadToHead}
					<button
						type="button"
						class={cn(
							interactive,
							'flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80'
						)}
						onclick={onHeadToHead}
					>
						{@render headToHeadValue(headToHead)}
					</button>
				{:else if headToHead}
					{@render headToHeadValue(headToHead)}
				{/if}
			</PlayerFact>
		{/if}
		<PlayerFact
			label={t('Steam ID')}
			icon={IdentificationCardIcon}
			sub={joinedSince ? t('Joined {date}', { date: joinedSince }) : null}
		>
			<span class="flex min-w-0 items-center gap-1.5">
				<a
					href="https://steamcommunity.com/profiles/{player.steamId}"
					target="_blank"
					rel="noopener noreferrer"
					class={cn(interactive, 'hover:text-primary truncate font-sans text-sm transition-colors')}
				>
					{player.steamId}
				</a>
				<CopyButton value={player.steamId} label={t('Copy Steam ID')} />
			</span>
		</PlayerFact>
		{#if player.smurf}
			<PlayerFact label={t('Smurf account')} icon={WarningIcon}>
				<SmurfAlert smurf={player.smurf} showLabel={false} />
			</PlayerFact>
		{/if}
	</PlayerFacts>
{/if}
<PlayerCompanionStaffDebug steamId={player.steamId} />
