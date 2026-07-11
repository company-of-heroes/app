<script lang="ts">
	import type { Profile } from '$lib/components/ui/profile';
	import * as List from '$lib/components/ui/list';
	import { Leaderboard } from '$lib/components/leaderboard';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { upperCase } from 'lodash-es';

	type Props = {
		player: Profile;
	};

	let { player }: Props = $props();
	let statsExpanded = $state(false);

	const statsCount = $derived(player.relic.leaderboardStats?.length ?? 0);
</script>

<div
	class={cn(
		'bg-secondary-950/40 border-secondary-900 overflow-clip rounded-lg border',
		'hover:border-secondary-700 transition-colors'
	)}
>
	<div class="border-secondary-800 flex items-center gap-4 border-b p-4">
		<a href="/players/{player.relic.profile_id}" class={cn(interactive, 'shrink-0')}>
			<img
				src={player.steam.avatarfull}
				alt={player.relic.alias}
				class="h-16 w-16 rounded-xl object-cover"
			/>
		</a>
		<div class="min-w-0 grow">
			<a
				href="/players/{player.relic.profile_id}"
				class={cn(interactive, 'hover:text-primary flex items-center gap-2 transition-colors')}
			>
				{#if player.relic.country}
					<img
						class="h-5 w-auto shrink-0 rounded-[2px]"
						src="https://flagsapi.com/{upperCase(player.relic.country)}/shiny/64.png"
						alt={player.relic.country}
					/>
				{/if}
				<span class="truncate text-lg font-bold">{player.relic.alias}</span>
			</a>
			<List.Root class="mt-2">
				<List.Title>Steam ID:</List.Title>
				<List.Value>{player.steam.steamid}</List.Value>
				<List.Title>Profile ID:</List.Title>
				<List.Value>{player.relic.profile_id}</List.Value>
			</List.Root>
		</div>
	</div>
	{#if statsCount > 0}
		<button
			type="button"
			class={cn(
				interactive,
				'text-secondary-300 hover:text-primary hover:bg-secondary-900/40 flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors'
			)}
			aria-expanded={statsExpanded}
			onclick={() => (statsExpanded = !statsExpanded)}
		>
			<span>Stats ({statsCount})</span>
			<CaretDown class={cn('size-4 transition-transform', statsExpanded && 'rotate-180')} />
		</button>
		{#if statsExpanded}
			<div class="border-secondary-800 border-t">
				<Leaderboard stats={player.relic.leaderboardStats!} class="rounded-none border-0" />
			</div>
		{/if}
	{:else}
		<div class="text-secondary-300 px-4 py-3 text-sm">
			Level <span class="font-medium text-white">{player.relic.level}</span>
		</div>
	{/if}
</div>
