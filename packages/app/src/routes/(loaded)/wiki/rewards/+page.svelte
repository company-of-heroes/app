<script lang="ts">
	import { page } from '$app/state';
	import {
		Catalog as RewardCatalog,
		CatalogSkeleton as RewardCatalogSkeleton
	} from '@company-of-heroes/ui/reward';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import WikiPage from '$lib/wiki/wiki-page.svelte';

	/** Signed-in users see their own account by default; an empty `?player=` shows the plain catalog. */
	const steamId = $derived(
		page.url.searchParams.get('player') ?? app.features.auth.user?.steamIds?.[0] ?? ''
	);

	/** The catalog, and with `?player=` what that player unlocked (the owner also gets progress). */
	async function load() {
		const player = /^\d{17}$/.test(steamId) ? steamId : null;
		const [rewards, profile] = await Promise.all([
			unwrapApi(api.rewards.catalog()),
			player
				? Promise.all([
						unwrapApi(api.players.get(player)),
						unwrapApi(api.rewards.forPlayer(player))
					])
						.then(([data, playerRewards]) => ({
							steamId: player,
							name: data.alias,
							rewards: playerRewards
						}))
						.catch(() => null)
				: null
		]);
		return { rewards, player: profile };
	}
</script>

<WikiPage key={steamId} {load}>
	{#snippet skeleton()}
		<RewardCatalogSkeleton />
	{/snippet}
	{#snippet children(data)}
		<RewardCatalog rewards={data.rewards} player={data.player} />
	{/snippet}
</WikiPage>
