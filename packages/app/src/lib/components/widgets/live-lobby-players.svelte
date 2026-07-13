<script lang="ts">
	import type { LiveLobby } from '$core/app/database/lobbies-live';
	import type { LobbyPlayer } from '@fknoobs/app';
	import { relic } from '$lib/relic';
	import { resource } from 'runed';
	import LobbyPlayersGrid from './lobby-players-grid.svelte';
	import { getLiveLobbyMatchType, getPlayerProfileId } from './dashboard-utils';

	type Props = {
		lobby: LiveLobby;
	};

	let { lobby }: Props = $props();

	const matchType = $derived(getLiveLobbyMatchType(lobby.players, lobby.isRanked));

	async function enrichPlayersWithMatchHistory(players: LobbyPlayer[]): Promise<LobbyPlayer[]> {
		return Promise.all(
			players.map(async (player) => {
				if (player.playerId === -1) return player;

				const profileId = getPlayerProfileId(player);
				if (!profileId) return player;

				try {
					const matchHistory = await relic.getRecentMatchHistoryForProfile(profileId);
					return { ...player, matchHistory };
				} catch (error) {
					console.warn('[LIVE_LOBBY]: failed to fetch match history for', profileId, error);
					return player;
				}
			})
		);
	}

	const players = resource(
		() => ({ key: `${lobby.id}:${lobby.updatedAt}`, players: lobby.players ?? [] }),
		({ players: sourcePlayers }) => enrichPlayersWithMatchHistory(sourcePlayers)
	);

	const resolvedPlayers = $derived(players.current ?? lobby.players ?? []);
</script>

<LobbyPlayersGrid players={resolvedPlayers} {matchType} />
