<script lang="ts">
	import { PlayerSearchCard, type PlayerSearchResult } from '@company-of-heroes/ui/player';
	import type { Profile } from '$lib/components/ui/profile';
	import {
		labelsForSteamId,
		preloadPlayerLabels
	} from '$core/pocketbase/player-label-cache.svelte';
	import {
		likeCountForSteamId,
		preloadPlayerLikeCounts
	} from '$core/pocketbase/player-vote-cache.svelte';
	import type { Snapshot } from '@sveltejs/kit';
	import * as Player from '$lib/components/player';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { relic } from '$lib/relic';
	import { steam } from '$core/steam';
	import { goto } from '$app/navigation';
	import { isProfileId, isSteamId } from '$lib/utils';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import {
		mergeSteamProfiles,
		PlayersSearch,
		type PlayersSearchState
	} from './players-search.svelte';
	import { useI18n } from '$lib/i18n';

	let playersSearch = $state(new PlayersSearch());
	let loading = $state(false);
	const { t } = useI18n();
	const canSearch = $derived(playersSearch.query.trim().length > 0 && !loading);

	async function search(event: SubmitEvent) {
		event.preventDefault();

		const trimmed = playersSearch.query.trim();
		if (!trimmed) {
			return;
		}

		loading = true;
		playersSearch.error = null;
		playersSearch.resetResults();

		try {
			if (isSteamId(trimmed) || isProfileId(trimmed)) {
				const profile = await relic.resolveProfile(trimmed);

				if (!profile) {
					playersSearch.error = t('Player not found');
					return;
				}

				await goto(`/players/${profile.profile_id}`);
				return;
			}

			const players = await relic.searchProfilesByName(trimmed);

			if (players.length === 0) {
				playersSearch.error = t('Player not found');
				return;
			}

			const steamIds = players.map((profile) => profile.name.replace('/steam/', ''));
			const steamProfiles = await steam.getUserProfiles(steamIds);
			playersSearch.results = mergeSteamProfiles(players, steamProfiles);

			if (playersSearch.results.length === 0) {
				playersSearch.error = t('Player not found');
			}
		} catch {
			playersSearch.error = t('Failed to search for player');
		} finally {
			loading = false;
		}
	}

	export const snapshot: Snapshot<PlayersSearchState> = {
		capture: () => playersSearch.capture(),
		restore: (state) => playersSearch.restore(state)
	};

	$effect(() => {
		const ids = playersSearch.results.map((player) => player.steam.steamid).filter(Boolean);
		if (ids.length > 0) {
			preloadPlayerLabels(ids);
			preloadPlayerLikeCounts(ids);
		}
	});

	/** Desktop search results carry Relic + Steam profiles; the shared card wants the flat shape. */
	function toSearchCard(player: Profile) {
		const steamId = player.steam.steamid;
		return {
			profileId: player.relic.profile_id,
			alias: player.relic.alias,
			country: player.relic.country ?? null,
			level: player.relic.level,
			steamId,
			avatarUrl: player.steam.avatarfull,
			likeCount: likeCountForSteamId(steamId) ?? undefined,
			labels: labelsForSteamId(steamId),
			leaderboardStats: player.relic.leaderboardStats ?? []
		} satisfies PlayerSearchResult & Record<string, unknown>;
	}
</script>

<Form.Root onsubmit={search}>
	<Form.Group
		inputId="player-search"
		label={t('Find a player')}
		description={t('Search for a player by Steam ID, profile ID, or in-game name.')}
	>
		<Input
			id="player-search"
			type="text"
			placeholder={t('Steam ID, profile ID, or player name')}
			bind:value={playersSearch.query}
			disabled={loading}
			aria-label={t('Find a player')}
		/>
		<Button
			type="submit"
			variant="secondary"
			class="w-fit shrink-0"
			{loading}
			disabled={!canSearch}
		>
			<MagnifyingGlassIcon size={16} />
			{t('Search')}
		</Button>
	</Form.Group>
</Form.Root>

{#if playersSearch.error}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{playersSearch.error}</Alert>
	</div>
{/if}

{#if playersSearch.results.length > 0}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{playersSearch.results.length === 1
			? t('{count} player found', { count: playersSearch.results.length })
			: t('{count} players found', { count: playersSearch.results.length })}
	</p>
	<div>
		{#each playersSearch.results as player (player.relic.profile_id)}
			<PlayerSearchCard player={toSearchCard(player)} />
		{/each}
	</div>
{/if}
