<script lang="ts">
	import { H } from '$lib/components/ui/h';
	import WidgetDashboardHero from '$lib/components/widgets/widget-dashboard-hero.svelte';
	import WidgetActiveMatch from '$lib/components/widgets/widget-active-match.svelte';
	import WidgetLiveLobbies from '$lib/components/widgets/widget-live-lobbies.svelte';
	import WidgetMatchHistory from '$lib/components/widgets/widget-match-history.svelte';
	import { app } from '$core/app/context';

	const hasActiveLobby = $derived(Boolean(app.lobby));
</script>

<H level="1">Dashboard</H>

<div class="space-y-12">
	<WidgetDashboardHero />

	{#if hasActiveLobby}
		<WidgetActiveMatch />
	{/if}

	<WidgetLiveLobbies />

	<WidgetMatchHistory />
</div>
