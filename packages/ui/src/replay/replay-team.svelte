<script lang="ts">
	import { useHost } from '../host/host.context';
	import TeamPlayerList from '../match/team-player-list.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import { communityPlayerHref } from './links';
	import type { CommunityMatch, CommunityPlayer } from './types';
	import { teamPlayers } from './utils';

	type Props = {
		match: CommunityMatch;
		side: 'allies' | 'axis';
		meSteamIds?: string[];
		/** Players the list is filtered on (profile id, Steam ID or alias); shown in blue. */
		highlightedPlayers?: string[];
		class?: string;
		/** Height and padding of each player line. */
		itemClass?: string;
		/** Doctrine after the name; off where columns are narrow. */
		showNotes?: boolean;
		mirrored?: boolean;
	};

	const host = useHost();

	let {
		match,
		side,
		meSteamIds,
		highlightedPlayers,
		class: className,
		itemClass,
		showNotes = true,
		mirrored = false
	}: Props = $props();

	/** Only players with a profile to open get a link. */
	function href(player: CommunityPlayer) {
		const previewId = playerPreviewId({
			steamId: player.steamId,
			profileId: player.profile.profile_id > 0 ? player.profile.profile_id : null
		});
		return previewId ? communityPlayerHref(player, host.routes) : null;
	}

	const players = $derived(
		teamPlayers(match, side).map((player) => ({
			race: player.race,
			alias: player.profile.alias,
			steamId: player.steamId,
			profileId: player.profile.profile_id,
			stats: player.stats,
			likeCount: player.likeCount,
			country: player.country ?? null,
			note: showNotes ? (player.doctrineName ?? null) : null,
			href: href(player)
		}))
	);
</script>

<TeamPlayerList
	{players}
	{meSteamIds}
	{highlightedPlayers}
	showRankBadges={match.isRanked}
	class={className}
	{itemClass}
	{mirrored}
/>
