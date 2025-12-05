<script lang="ts">
	import { Leaderboard } from '$lib/components/leaderboard';
	import { useProfile } from '.';

	const profile = useProfile();
</script>

<Leaderboard stats={profile.relic.leaderboardStats!} />
