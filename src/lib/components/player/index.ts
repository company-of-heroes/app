import { createPlayer, usePlayer } from './context';
import Player from './player.svelte';
import PlayerCountry from './player-country.svelte';
import PlayerAlias from './player-alias.svelte';
import PlayerWins from './player-wins.svelte';
import PlayerLosses from './player-losses.svelte';
import PlayerStreak from './player-streak.svelte';
import PlayerRank from './player-rank.svelte';
import PlayerLevel from './player-level.svelte';
import PlayerPosition from './player-position.svelte';
import PlayerFaction from './player-faction.svelte';
import PlayerAvatar from './player-avatar.svelte';
import PlayerRatingChange from './player-rating-change.svelte';

export {
	createPlayer,
	usePlayer,
	Player as Root,
	PlayerCountry as Country,
	PlayerAlias as Alias,
	PlayerWins as Wins,
	PlayerLosses as Losses,
	PlayerStreak as Streak,
	PlayerRank as Rank,
	PlayerLevel as Level,
	PlayerPosition as Position,
	PlayerFaction as Faction,
	PlayerAvatar as Avatar,
	PlayerRatingChange as RatingChange
};
