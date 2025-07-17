<script lang="ts">
	import * as Nav from '$lib/components/ui/nav';
	import { app } from '$core/app';
	import { Toaster } from 'svelte-sonner';
	import GearIcon from 'phosphor-svelte/lib/Gear';

	import '$lib/fonts/futura-pt-webfont/style.css';
	import '$lib/fonts/gotham/style.css';
	import '$lib/fonts/TT Firs Neue/style.css';
	import '$lib/fonts/TT Corals/style.css';
	import '$lib/fonts/TT Mussels/style.css';
	import '$lib/fonts/TT Barrels/style.css';
	import '@fontsource/league-gothic';
	import '@fontsource/bebas-neue';

	import '../app.css';
	import { Dialog } from '$lib/components/ui/dialog';

	let { children } = $props();
	let Component = $derived(app.currentRoute?.component);

	// $effect(() => {
	// 	(async () => {
	// 		console.time('Replay Parsing');
	// 		const replay = await ReplayParser.parse(
	// 			'C:/Users/Richa/OneDrive/Documenten/My Games/Company of Heroes Relaunch/playback/temp.rec'
	// 		);

	// 		console.timeEnd('Replay Parsing');
	// 		console.log('Parsed Replay:', replay);
	// 	})();
	// });
</script>

<svelte:boundary>
	{#snippet pending()}{/snippet}
	<div class="bg-secondary-950 flex h-screen overflow-hidden">
		<aside class="bg-primary/2 border-secondary-700 w-62 border-r p-[4px]">
			<Nav.Root class="bg-secondary-900 h-full">
				{#each app.routes as { href, title, path, component } (href)}
					<Nav.Link {href} {component} {path}>{title}</Nav.Link>
				{/each}
				<a href="/settings" class="bg-secondary-800 mt-auto flex items-center px-4 py-3">
					<GearIcon />
					<span class="ml-2">Settings</span>
				</a>
			</Nav.Root>
		</aside>
		<div class="bg-secondary-950 flex flex-1 flex-col overflow-auto">
			<div class="border-secondary-700 bg-primary/2 border-b p-[4px]">
				<h1 class="bg-secondary-900 px-8 py-6 text-3xl font-bold">{app.currentRoute?.title}</h1>
			</div>
			<main class="flex-1 p-8">
				{#if Component}
					<Component />
				{:else}
					{@render children()}
				{/if}
			</main>
		</div>
	</div>
</svelte:boundary>

<Toaster
	expand={true}
	toastOptions={{
		unstyled: true,
		classes: {
			toast: 'bottom-0 right-0 flex gap-2 items-center px-4 py-2 shadow',
			title: 'text-secondary-900',
			description: 'text-secondary-900',
			actionButton: 'text-secondary-900',
			cancelButton: 'text-secondary-900',
			closeButton: 'text-secondary-900',
			success: '[&_svg]:fill-black bg-primary'
		}
	}}
/>

<Dialog />
