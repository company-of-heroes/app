import { createMatch, useMatch } from './context';
import Match from './match.svelte';
import MatchMapImage from './match-map-image.svelte';
import MatchMapName from './match-map-name.svelte';
import MatchTitle from './match-title.svelte';
import MatchPlayers from './match-players.svelte';
import MatchRating from './match-rating.svelte';
import MatchDate from './match-date.svelte';
import MatchStatus from './match-status.svelte';

export {
	createMatch,
	useMatch,
	Match as Root,
	MatchMapImage as MapImage,
	MatchMapName as MapName,
	MatchTitle as Title,
	MatchPlayers as Players,
	MatchRating as Rating,
	MatchDate as Date,
	MatchStatus as Status
};
