<script lang="ts">
	import type { Profile } from '$lib/components/ui/profile';
	import * as List from '$lib/components/ui/list';
	import { Leaderboard } from '$lib/components/leaderboard';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import CaretDown from 'phosphor-svelte/lib/CaretDownIcon';
	import { upperCase } from 'lodash-es';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import { resource } from 'runed';
	import { useI18n } from '$lib/i18n';
	import PlayerLabels from './player-labels.svelte';
	import PlayerLikeCount from './player-like-count.svelte';
	import { PlayerProfileLink, playerPreviewId } from '@company-of-heroes/ui/player';

	type Props = {
		player: Profile;
	};

	let { player }: Props = $props();
	const { t } = useI18n();
	let statsExpanded = $state(false);

	const statsCount = $derived(player.relic.leaderboardStats?.length ?? 0);
	const storedRating = resource(
		() => (statsExpanded ? player.steam.steamid : null),
		(steamId) => (steamId ? getPlayerRating(steamId) : Promise.resolve(null))
	);

	const href = $derived(`/players/${player.relic.profile_id}`);
	const previewId = $derived(
		playerPreviewId({
			steamId: player.steam.steamid,
			profileId: player.relic.profile_id
		}) ?? String(player.relic.profile_id)
	);
</script>

<div class="border-secondary-800 overflow-clip border-b">
	<div class="border-secondary-800 flex gap-4 border-b p-4">
		<PlayerProfileLink {href} playerId={previewId} class={cn(interactive, 'shrink-0')}>
			<img
				src={player.steam.avatarfull}
				alt={player.relic.alias}
				class="size-16 rounded-xl border-3 border-gray-400 object-cover"
			/>
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
				{#if player.relic.country}
					<img
						class="h-5 w-auto shrink-0 rounded-xs"
						src="https://flagsapi.com/{upperCase(player.relic.country)}/shiny/64.png"
						alt={player.relic.country}
					/>
				{/if}
				<PlayerLikeCount steamId={player.steam.steamid} class="shrink-0" />
				<span class="font-heading truncate text-xl font-bold">{player.relic.alias}</span>
				<PlayerLabels steamId={player.steam.steamid} class="shrink-0" />
			</PlayerProfileLink>
			<List.Root class="gap-x-4">
				<List.Title>{t('Steam ID:')}</List.Title>
				<List.Value>{player.steam.steamid}</List.Value>
				<List.Title>{t('Profile ID:')}</List.Title>
				<List.Value>{player.relic.profile_id}</List.Value>
			</List.Root>
		</div>
	</div>
	{#if statsCount > 0}
		<button
			type="button"
			class={cn(
				interactive,
				'text-secondary-400 hover:text-primary flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors'
			)}
			aria-expanded={statsExpanded}
			onclick={() => (statsExpanded = !statsExpanded)}
		>
			<span>{t('Stats ({count})', { count: statsCount })}</span>
			<CaretDown class={cn('size-4 transition-transform', statsExpanded && 'rotate-180')} />
		</button>
		{#if statsExpanded}
			<div class="border-secondary-800 border-t">
				<Leaderboard
					stats={player.relic.leaderboardStats!}
					elo={storedRating.current?.elo ?? {}}
					class="rounded-none border-0"
				/>
			</div>
		{/if}
	{:else}
		<div class="text-secondary-400 px-4 py-3 text-sm">
			{t('Level')} <span class="text-secondary-200 font-medium">{player.relic.level}</span>
		</div>
	{/if}
</div>
