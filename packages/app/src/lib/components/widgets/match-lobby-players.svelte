<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { LobbyPlayer, TransformedMatch } from '@fknoobs/app';
	import { app } from '$core/app/context';
	import LobbyPlayersGrid from './lobby-players-grid.svelte';
	import { getLiveLobbyMatchType } from './dashboard-utils';
	import { getPlayerRatings } from '$core/pocketbase/player-ratings';
	import { isValidSteamId } from '$lib/utils/player-elo';
	import { resource } from 'runed';

	type Props = {
		match: MatchExpanded;
		cheaters?: Set<string>;
	};

	let { match, cheaters }: Props = $props();

	const matchType = $derived(getLiveLobbyMatchType(match.players ?? [], match.isRanked));
	const result = $derived(match.result as TransformedMatch | null | undefined);
	const highlightPlayerId = $derived(app.game.profile?.relic.profile_id);
	const ratingsKey = $derived(
		(match.players ?? [])
			.map((player) => player.steamId)
			.filter(isValidSteamId)
			.join(',')
	);
	const ratings = resource(
		() => ratingsKey,
		(key) => getPlayerRatings(key ? key.split(',') : [])
	);
	const players = $derived.by((): LobbyPlayer[] => {
		const source = match.players ?? [];
		const stored = ratings.current;
		if (!stored) {
			return source;
		}

		return source.map((player) => {
			if (!player.steamId) {
				return player;
			}

			const record = stored.get(player.steamId);
			return record ? { ...player, storedElo: record.elo } : player;
		});
	});
</script>

<LobbyPlayersGrid {players} {matchType} {highlightPlayerId} {result} {cheaters} />
