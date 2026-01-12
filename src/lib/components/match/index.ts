import { createMatch, useMatch } from './context';
import Match from './match.svelte';
import MatchMapImage from './match-map-image.svelte';
import MatchMapName from './match-map-name.svelte';
import MatchTitle from './match-title.svelte';
import MatchPlayers from './match-players.svelte';
import MatchRating from './match-rating.svelte';
import MatchDate from './match-date.svelte';
import MatchTime from './match-time.svelte';
import MatchStatus from './match-status.svelte';
import MatchDuration from './match-duration.svelte';

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
	MatchTime as Time,
	MatchStatus as Status,
	MatchDuration as Duration
};
