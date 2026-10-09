<script lang="ts">
	import WidgetDashboardHero from '$lib/components/widgets/widget-dashboard-hero.svelte';
	import WidgetLiveLobbies from '$lib/components/widgets/widget-live-lobbies.svelte';
	import WidgetLiveStreams from '$lib/components/widgets/widget-live-streams.svelte';
	import WidgetMatchHistory from '$lib/components/widgets/widget-match-history.svelte';
	import WidgetTournamentMatch from '$lib/components/widgets/widget-tournament-match.svelte';
	import WidgetTournaments from '$lib/components/widgets/widget-tournaments.svelte';
	import GameLogNotice from '$lib/components/widgets/game-log-notice.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<div>
	<GameLogNotice
		class="m-4"
		message={t(
			'Set your Company of Heroes warnings.log in Settings to turn on live game tracking and match recording.'
		)}
	/>
	<WidgetDashboardHero />
	<WidgetTournamentMatch />
	<WidgetTournaments />
	<WidgetLiveLobbies />
	<WidgetLiveStreams />
	<WidgetMatchHistory />
</div>
