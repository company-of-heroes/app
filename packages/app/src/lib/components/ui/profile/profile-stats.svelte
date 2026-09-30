<script lang="ts">
	import { PlayerStatsTable } from '@company-of-heroes/ui/player';
	import { useProfile } from '.';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import { resource } from 'runed';

	const profile = useProfile();
	const storedRating = resource(
		() => profile.steam.steamid,
		(steamId) => getPlayerRating(steamId)
	);
</script>

<PlayerStatsTable stats={profile.relic.leaderboardStats!} elo={storedRating.current?.elo ?? {}} />
