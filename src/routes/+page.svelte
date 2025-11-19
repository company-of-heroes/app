<script lang="ts">
	import { app } from '$core/app';
	import { H } from '$lib/components/ui/h';
	import { WidgetStatus } from '$lib/components/widgets';
	import WidgetCurrentGame from '$lib/components/widgets/widget-current-game.svelte';
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

<div class="mt-12">
	<WidgetCurrentGame />
</div>
