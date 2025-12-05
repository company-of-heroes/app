<script lang="ts">
	import { app } from '$core/app';
	import { H } from '$lib/components/ui/h';
	import { WidgetStatus } from '$lib/components/widgets';
	import { Alert } from '$lib/components/ui/alert';
	import WidgetCurrentGame from '$lib/components/widgets/widget-current-game.svelte';
	import WidgetProfile from '$lib/components/widgets/widget-profile.svelte';
</script>

<H level="1">Dashboard</H>

<div class="flex gap-4">
	<WidgetStatus status={app.statuses.companyOfHeroes} info="Company of Heroes game status">
		Company of Heroes
	</WidgetStatus>
	<WidgetStatus
		status={app.statuses.websocketServer}
		info="Real-time WebSocket server for bidirectional communication and event handling across the application"
	>
		Websocket server
	</WidgetStatus>
	<WidgetStatus status={app.statuses.webserver} info="Tiny webserver used to serve the overlays">
		Web server
	</WidgetStatus>
</div>

{#if app.game.isRunning}
	<div class="mt-8 grid gap-8">
		<div>
			<WidgetProfile />
		</div>
		<div>
			<WidgetCurrentGame />
		</div>
	</div>
{:else}
	<Alert variant="warning" class="mt-4">Company of Heroes is not running.</Alert>
{/if}
