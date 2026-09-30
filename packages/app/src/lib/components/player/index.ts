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
import PlayerRating from './player-rating.svelte';
import PlayerRatingChange from './player-rating-change.svelte';
import PlayerWidgetSkeleton from './player-widget-skeleton.svelte';
import PlayerLabels from './player-labels.svelte';
import PlayerLabelEditor from './player-label-editor.svelte';
import CheaterAlert from './cheater-alert.svelte';
import PlayerScreenshots from './player-screenshots.svelte';
import PlayerLikeCount from './player-like-count.svelte';
import { PlayerProfileSkeleton } from '@company-of-heroes/ui/player';

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
	PlayerRating as Rating,
	PlayerFaction as Faction,
	PlayerAvatar as Avatar,
	PlayerRatingChange as RatingChange,
	PlayerProfileSkeleton as ProfileSkeleton,
	PlayerWidgetSkeleton as WidgetSkeleton,
	PlayerLabels as Labels,
	PlayerLabelEditor as LabelEditor,
	PlayerLikeCount as LikeCount,
	CheaterAlert,
	PlayerScreenshots as Screenshots
};
