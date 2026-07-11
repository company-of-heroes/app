<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import * as Player from '$lib/components/player';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import * as Form from '$lib/components/ui/form';
	import { H } from '$lib/components/ui/h';
	import { relic } from '$lib/relic';
	import { steam } from '$core/steam';
	import { goto } from '$app/navigation';
	import { cn, isProfileId, isSteamId } from '$lib/utils';
	import {
		mergeSteamProfiles,
		PlayersSearch,
		type PlayersSearchState
	} from './players-search.svelte';

	let playersSearch = $state(new PlayersSearch());
	let loading = $state(false);

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
					playersSearch.error = 'Player not found';
					return;
				}

				await goto(`/players/${profile.profile_id}`);
				return;
			}

			const players = await relic.searchProfilesByName(trimmed);

			if (players.length === 0) {
				playersSearch.error = 'Player not found';
				return;
			}

			const steamIds = players.map((profile) => profile.name.replace('/steam/', ''));
			const steamProfiles = await steam.getUserProfiles(steamIds);
			playersSearch.results = mergeSteamProfiles(players, steamProfiles);

			if (playersSearch.results.length === 0) {
				playersSearch.error = 'Player not found';
			}
		} catch {
			playersSearch.error = 'Failed to search for player';
		} finally {
			loading = false;
		}
	}

	export const snapshot: Snapshot<PlayersSearchState> = {
		capture: () => playersSearch.capture(),
		restore: (state) => playersSearch.restore(state)
	};

	$inspect(playersSearch.results);
</script>

<H level="1">Players</H>

<p class="text-secondary-300 mb-6">Search for a player by Steam ID, profile ID, or in-game name.</p>

<Form.Root class="mb-4 flex max-w-xl items-end gap-3" onsubmit={search}>
	<Form.Group class="mb-0 grow">
		<Form.Label for="player-search">Search</Form.Label>
		<Input
			id="player-search"
			type="text"
			placeholder="Steam ID, profile ID, or player name"
			class={cn('w-full grow')}
			bind:value={playersSearch.query}
			disabled={loading}
		/>
	</Form.Group>
	<Button type="submit" {loading} disabled={!playersSearch.query.trim() || loading}>Search</Button>
</Form.Root>

{#if playersSearch.error}
	<Alert variant="destructive" class="mb-4">{playersSearch.error}</Alert>
{/if}

{#if playersSearch.results.length > 0}
	<p class="text-secondary-300 mb-4">
		{playersSearch.results.length} player{playersSearch.results.length === 1 ? '' : 's'} found
	</p>
	<div class="grid grid-cols-1 gap-4">
		{#each playersSearch.results as player (player.relic.profile_id)}
			<Player.SearchCard {player} />
		{/each}
	</div>
{/if}
