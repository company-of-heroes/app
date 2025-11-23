import type { LobbyPlayer } from '@fknoobs/app';
import { Context } from 'runed';
import Player from './player.svelte';
import PlayerCountry from './player-country.svelte';
import PlayerAlias from './player-alias.svelte';
import PlayerWins from './player-wins.svelte';
import PlayerLosses from './player-losses.svelte';
import PlayerRank from './player-rank.svelte';

const context = new Context<LobbyPlayer>('<player />');

export const createPlayer = (player: LobbyPlayer) => context.set(player);
export const usePlayer = () => context.get();

export {
	Player as Root,
	PlayerCountry as Country,
	PlayerAlias as Alias,
	PlayerWins as Wins,
	PlayerLosses as Losses,
	PlayerRank as Rank
};
