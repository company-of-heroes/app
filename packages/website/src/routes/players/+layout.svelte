<script lang="ts">
	import { navigating, page } from '$app/state';
	import CardForm from '$lib/components/player/card-form.svelte';
	import PlayerProfileSkeleton from '$lib/components/player/player-profile-skeleton.svelte';
	import { unlocalizedPath } from '$lib/i18n';
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();

	const loadingPlayer = $derived.by(() => {
		const target = navigating.to;
		if (!target?.params?.id) return false;
		const path = unlocalizedPath(target.url.pathname);
		return path.startsWith('/players/') && path !== '/players';
	});
	const isLookup = $derived(unlocalizedPath(page.url.pathname) === '/players' && !loadingPlayer);
	const formQuery = $derived(
		navigating.to?.params?.id ?? page.params.id ?? page.url.searchParams.get('q') ?? ''
	);
</script>

{#if isLookup}
	{@render children()}
{:else}
	<CardForm initialQuery={formQuery} />
	{#if loadingPlayer}
		<PlayerProfileSkeleton />
	{:else}
		{@render children()}
	{/if}
{/if}
