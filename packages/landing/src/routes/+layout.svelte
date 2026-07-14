<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { loadLatestDownload } from '$lib/download.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		void loadLatestDownload();
	});
</script>

<div class="bg-secondary-950 min-h-screen font-sans">
	<Header />
	{@render children()}
	<Footer />
</div>
