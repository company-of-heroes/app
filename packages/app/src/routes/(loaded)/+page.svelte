<script lang="ts">
	import { goto } from '$app/navigation';
	import { H } from '$lib/components/ui/h';
	import WidgetDashboardHero from '$lib/components/widgets/widget-dashboard-hero.svelte';
	import WidgetLiveLobbies from '$lib/components/widgets/widget-live-lobbies.svelte';
	import WidgetMatchHistory from '$lib/components/widgets/widget-match-history.svelte';
	import { app } from '$core/app/context';

	$effect(() => {
		const off = app.on('lobby.started', () => {
			goto('/current-game');
		});
		return off;
	});
</script>

<H level="1">Dashboard</H>

<div class="space-y-12">
	<WidgetDashboardHero />

	<WidgetLiveLobbies />

	<WidgetMatchHistory />
</div>
