import { createPlayer, usePlayer } from './context';
import Player from './player.svelte';
import PlayerCountry from './player-country.svelte';
import PlayerAlias from './player-alias.svelte';
import PlayerWins from './player-wins.svelte';
import PlayerLosses from './player-losses.svelte';
import PlayerRank from './player-rank.svelte';
import PlayerFaction from './player-faction.svelte';
import PlayerRatingChange from './player-rating-change.svelte';

export {
	createPlayer,
	usePlayer,
	Player as Root,
	PlayerCountry as Country,
	PlayerAlias as Alias,
	PlayerWins as Wins,
	PlayerLosses as Losses,
	PlayerRank as Rank,
	PlayerFaction as Faction,
	PlayerRatingChange as RatingChange
};
