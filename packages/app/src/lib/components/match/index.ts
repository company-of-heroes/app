import { createMatch, useMatch } from './context';
import Match from './match.svelte';
import MatchMapImage from './match-map-image.svelte';
import MatchMapName from './match-map-name.svelte';
import MatchTitle from './match-title.svelte';
import MatchType from './match-type.svelte';
import MatchPlayers from './match-players.svelte';
import MatchRating from './match-rating.svelte';
import MatchDate from './match-date.svelte';
import MatchTime from './match-time.svelte';
import MatchHost from './match-host.svelte';
import MatchStatus from './match-status.svelte';
import MatchDuration from './match-duration.svelte';
import MatchListTable from './match-list-table.svelte';
import MatchLikeButton from './match-like-button.svelte';
import MatchComments from './match-comments.svelte';
import MatchSocialCounts from './match-social-counts.svelte';
import MatchProBadge from './match-pro-badge.svelte';
import MatchPendingBadge from './match-pending-badge.svelte';
import MatchScreenshots from './match-screenshots.svelte';
import MatchOverview from './match-overview.svelte';
import {
	fromLiveLobby,
	fromMatchExpanded,
	fromReplayExpanded,
	liveLobbyToUiMatchListRow,
	resolveTeamOutcome,
	toMatchView,
	toUiMatchListRow
} from './match-view';

export {
	createMatch,
	useMatch,
	Match as Root,
	MatchMapImage as MapImage,
	MatchMapName as MapName,
	MatchTitle as Title,
	MatchType as Type,
	MatchPlayers as Players,
	MatchRating as Rating,
	MatchDate as Date,
	MatchTime as Time,
	MatchHost as Host,
	MatchStatus as Status,
	MatchDuration as Duration,
	MatchListTable as ListTable,
	MatchListTable,
	MatchLikeButton as LikeButton,
	MatchComments as Comments,
	MatchSocialCounts as SocialCounts,
	MatchProBadge as ProBadge,
	MatchPendingBadge as PendingBadge,
	MatchScreenshots as Screenshots,
	MatchOverview as Overview,
	fromMatchExpanded,
	fromReplayExpanded,
	fromLiveLobby,
	liveLobbyToUiMatchListRow,
	resolveTeamOutcome,
	toMatchView,
	toUiMatchListRow
};

export type { MatchListColumnId } from './match-list-columns';
export type { MatchListRow } from '@company-of-heroes/ui/match';
export type { MatchInput, MatchView, MatchViewResult, MatchViewResultPlayer } from './match-view';
