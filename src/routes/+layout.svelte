<script lang="ts">
	import { app } from '$core/app';
	import * as Nav from '$lib/components/ui/nav';

	import '$lib/fonts/futura-pt-webfont/style.css';
	import '$lib/fonts/gotham/style.css';
	import '$lib/fonts/TT Firs Neue/style.css';
	import '$lib/fonts/TT Corals/style.css';
	import '$lib/fonts/TT Mussels/style.css';
	import '$lib/fonts/TT Barrels/style.css';
	import '@fontsource/league-gothic';
	import '@fontsource/bebas-neue';

	import '../app.css';

	let { children } = $props();
</script>

<svelte:boundary>
	{#snippet pending()}{/snippet}
	<div class="flex h-screen w-screen overflow-hidden">
		<div class="min-w-[300px] border-r-2 border-gray-500 bg-gray-700">
			<Nav.Root>
				<Nav.Link href="/dashboard">Dashboard</Nav.Link>
				<Nav.Link href="/twitch">Twitch</Nav.Link>
			</Nav.Root>
		</div>
		<main class="grow p-8">
			{@render children()}
		</main>
	</div>
</svelte:boundary>
