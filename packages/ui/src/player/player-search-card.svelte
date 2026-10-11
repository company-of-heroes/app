<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { resource } from 'runed';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import { useHost } from '../host/host.context';
	import { CopyButton } from '../ui/copy-button';
	import * as List from '../ui/list';
	import type { LeaderboardStat, PlayerLabel, PlayerSearchResult } from './types';
	import PlayerLabels from './player-labels.svelte';
	import PlayerStreamerIcon from './player-streamer-icon.svelte';
	import PlayerLikeCount from './player-like-count.svelte';
	import PlayerProfileLink from './player-profile-link.svelte';
	import { playerPreviewId } from './player-preview-cache';
	import PlayerStatsTable from './player-stats-table.svelte';

	type Props = {
		player: PlayerSearchResult & {
			/** Left out: the host's cached labels for the Steam id. */
			labels?: PlayerLabel[];
			/** Left out: fetched when the stats are first opened. */
			leaderboardStats?: LeaderboardStat[];
		};
	};

	let { player }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let statsExpanded = $state(false);
	const href = $derived(host.routes.player(player.profileId || player.steamId));
	const flagSrc = $derived(host.resolve.flagImageUrl(player.country));
	const labels = $derived(
		player.labels ?? (player.steamId ? host.api.labels.forSteamId(player.steamId) : [])
	);
	const statsId = $derived(player.profileId ? String(player.profileId) : player.steamId);
	const stats = resource(
		() => (statsExpanded ? statsId : null),
		async (id) => {
			if (!id) {
				return null;
			}

			if (player.leaderboardStats) {
				const elo = player.steamId
					? await host.api.players.getElo(player.steamId).catch(() => ({}))
					: {};
				return { leaderboardStats: player.leaderboardStats, elo };
			}

			return host.api.players.getStats(id).catch(() => null);
		}
	);
	const statsCount = $derived(
		player.leaderboardStats?.length ?? stats.current?.leaderboardStats.length ?? null
	);
	/** Unknown until opened; a card that turned out to have none keeps its open panel. */
	const showStats = $derived(statsCount !== 0 || statsExpanded);
	const previewId = $derived(
		playerPreviewId({ steamId: player.steamId, profileId: player.profileId }) ??
			String(player.profileId)
	);
</script>

<div class="border-secondary-800 overflow-clip border-b">
	<div class={cn('flex gap-4 p-4', showStats && 'border-secondary-800 border-b')}>
		<PlayerProfileLink {href} playerId={previewId} class={cn(interactive, 'shrink-0')}>
			{#if player.avatarUrl}
				<img
					loading="lazy"
					decoding="async"
					src={host.resolve.avatarUrl(player.avatarUrl, { thumb: '100x100' })}
					alt={player.alias}
					class="size-16 rounded-xl border-3 border-gray-400 object-cover"
				/>
			{:else}
				<div class="bg-secondary-800 size-16 rounded-xl border-3 border-gray-400"></div>
			{/if}
		</PlayerProfileLink>
		<div class="min-w-0 grow py-1">
			<PlayerProfileLink
				{href}
				playerId={previewId}
				class={cn(
					interactive,
					'hover:text-primary mb-2 flex min-w-0 items-center gap-2 transition-colors'
				)}
			>
				{#if flagSrc}
					<img
						loading="lazy"
						decoding="async"
						class="h-5 w-auto shrink-0 rounded-xs"
						src={flagSrc}
						alt={player.country ?? ''}
					/>
				{/if}
				<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
				<PlayerStreamerIcon {labels} steamId={player.steamId} size={18} />
				<span class="font-heading truncate text-xl font-bold text-white">{player.alias}</span>
				<PlayerLabels {labels} class="shrink-0" />
			</PlayerProfileLink>
			<List.Root class="gap-x-4">
				<List.Title>{t('Steam ID:')}</List.Title>
				<List.Value>
					{#if player.steamId}
						<span class="inline-flex items-center gap-1.5">
							{player.steamId}
							<CopyButton value={player.steamId} label={t('Copy Steam ID')} />
						</span>
					{:else}
						—
					{/if}
				</List.Value>
				<List.Title>{t('Profile ID:')}</List.Title>
				<List.Value>{player.profileId}</List.Value>
			</List.Root>
		</div>
	</div>
	{#if showStats}
		<button
			type="button"
			class={cn(
				interactive,
				'text-secondary-400 hover:text-primary flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors'
			)}
			aria-expanded={statsExpanded}
			onclick={() => (statsExpanded = !statsExpanded)}
		>
			<span>
				{statsCount === null ? t('Stats') : t('Stats ({count})', { count: statsCount })}
			</span>
			<CaretDownIcon class={cn('size-4 transition-transform', statsExpanded && 'rotate-180')} />
		</button>
		{#if statsExpanded}
			<div class="border-secondary-800 border-t">
				{#if stats.loading && !stats.current}
					<p class="text-secondary-400 px-4 py-3 text-sm">{t('Loading…')}</p>
				{:else if stats.current?.leaderboardStats.length}
					<PlayerStatsTable stats={stats.current.leaderboardStats} elo={stats.current.elo} />
				{:else}
					<p class="text-secondary-400 px-4 py-3 text-sm">{t('No stats found.')}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
