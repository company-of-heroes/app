<script lang="ts">
	import logo from '@assets/logo-transparent-bg.png';
	import type { PlayerCardData, PlayerCardStat } from '$lib/player-card.svelte';
	import { getRankImageByLeaderboardId } from '$lib/ranks';
	import { SITE_URL } from '$lib/urls';

	type Props = {
		data: PlayerCardData;
		ref?: HTMLElement | null;
	};

	let { data, ref = $bindable(null) }: Props = $props();

	const cardUrl = $derived(`${SITE_URL}/card/${data.steamId}`);

	function flagUrl(country: string | null) {
		if (!country) {
			return null;
		}
		return `https://flagsapi.com/${country.toUpperCase()}/shiny/64.png`;
	}
</script>

<div
	bind:this={ref}
	class="border-primary/20 from-secondary-900 via-secondary-950 to-secondary-900 shadow-xl w-full max-w-4xl overflow-hidden rounded-2xl border bg-gradient-to-br"
>
	<div class="border-secondary-800/80 flex items-center justify-between border-b px-6 py-4">
		<div class="flex items-center gap-3">
			<img src={logo} alt="" class="size-8" />
			<div>
				<p class="text-sm font-semibold text-white">Company of Heroes</p>
				<p class="text-primary text-xs font-medium">Companion</p>
			</div>
		</div>
		<p class="text-secondary-500 text-xs">Player card</p>
	</div>

	<div class="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-center">
		<img
			src={data.avatarUrl}
			alt={data.alias}
			class="border-secondary-700 mx-auto size-28 shrink-0 rounded-2xl border object-cover sm:mx-0 sm:size-32"
		/>
		<div class="min-w-0 flex-1 text-center sm:text-left">
			<div class="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
				{#if flagUrl(data.country)}
					<img
						src={flagUrl(data.country)!}
						alt={data.country ?? ''}
						class="h-5 w-auto rounded-[2px]"
					/>
				{/if}
				<h2 class="truncate text-2xl font-extrabold text-white sm:text-3xl">{data.alias}</h2>
			</div>
			<p class="text-secondary-400 mt-2 text-sm">
				Level <span class="text-secondary-100 font-semibold">{data.level}</span>
				· Profile #{data.profileId}
			</p>
			<p class="text-secondary-500 mt-1 truncate text-xs">Steam ID {data.steamId}</p>
		</div>
	</div>

	{#if data.stats.length > 0}
		<div class="border-secondary-800/80 grid grid-cols-1 gap-3 border-t px-6 py-5 sm:grid-cols-2">
			{#each data.stats as stat (stat.leaderboardId)}
				{@render statRow(stat)}
			{/each}
		</div>
	{:else}
		<div class="border-secondary-800/80 text-secondary-400 border-t px-6 py-5 text-sm">
			No ranked leaderboard stats yet.
		</div>
	{/if}

	<div class="border-secondary-800/80 bg-secondary-950/60 border-t px-6 py-3">
		<p class="text-secondary-500 truncate text-center text-xs">{cardUrl}</p>
	</div>
</div>

{#snippet statRow(stat: PlayerCardStat)}
	<div class="border-secondary-800 bg-secondary-900/50 flex items-center gap-3 rounded-xl border p-3">
		<img
			src={getRankImageByLeaderboardId(stat.leaderboardId, stat.ranklevel)}
			alt=""
			class="size-12 shrink-0 object-contain"
		/>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold text-white">
				{stat.modeLabel}
				<span class="text-secondary-400 font-normal">· {stat.factionLabel}</span>
			</p>
			<p class="text-secondary-500 text-xs">
				Rank #{stat.rank} · {stat.wins}W / {stat.losses}L · streak {stat.streak}
			</p>
		</div>
	</div>
{/snippet}
