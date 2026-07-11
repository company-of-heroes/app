<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { MatchTypeId } from '$core/game/lobby';
	import * as Player from '$lib/components/player';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';

	type Props = {
		player: LobbyPlayer;
		matchType: MatchTypeId;
		isMe?: boolean;
	};

	let { player, matchType, isMe = false }: Props = $props();

	const stats = $derived(getLeaderboardStatsForPlayerByMatchType(matchType, player));
	const isCpu = $derived(player.playerId === -1);

	const factionClass = $derived(
		cn(
			'h-auto! w-6! shrink-0 rounded-none! object-contain! ring-1! ring-black/40',
			isMe && 'ring-primary!'
		)
	);
</script>

<Player.Root {player} {stats} race={player.race}>
	<div
		class={cn(
			'bg-secondary-950/40 border-secondary-900 overflow-clip rounded-lg border',
			'hover:border-secondary-700 transition-colors',
			isMe && 'border-primary'
		)}
	>
		<div class="border-secondary-800 flex flex-col gap-1 border-b p-4">
			<div class="flex min-w-0 items-center gap-3">
				{#if !isCpu}
					<span class="border-secondary-800 size-14 shrink-0 overflow-hidden rounded-lg border">
						<Player.Avatar class="size-full object-cover" />
					</span>
				{/if}
				<div class="flex min-w-0 items-center gap-2">
					<Player.Country />
					<Player.Alias class={cn('truncate text-lg font-bold', isMe && 'text-primary')} />
				</div>
			</div>
			{#if isCpu}
				<p class="text-secondary-400 text-sm">CPU opponent</p>
			{/if}
		</div>

		<div class="divide-secondary-800 flex items-stretch divide-x">
			<div class="flex shrink-0 items-center justify-center px-4 py-3">
				<Player.Faction class={factionClass} />
			</div>
			{#if !isCpu}
				<dl class="grid min-w-0 flex-1 grid-cols-5 px-1 py-3 text-center text-sm">
					<div class="px-2">
						<dt class="text-secondary-500 text-xs font-medium uppercase">Level</dt>
						<dd class="mt-1 flex items-center justify-center gap-2 font-medium tabular-nums">
							<Player.Rank />
							<Player.Level />
						</dd>
					</div>
					<div class="px-2">
						<dt class="text-secondary-500 text-xs font-medium uppercase">Rank</dt>
						<dd class="text-secondary-300 mt-1 tabular-nums">
							<Player.Position />
						</dd>
					</div>
					<div class="px-2">
						<dt class="text-secondary-500 text-xs font-medium uppercase">Wins</dt>
						<dd class="mt-1">
							<Player.Wins />
						</dd>
					</div>
					<div class="px-2">
						<dt class="text-secondary-500 text-xs font-medium uppercase">Losses</dt>
						<dd class="mt-1">
							<Player.Losses />
						</dd>
					</div>
					<div class="px-2">
						<dt class="text-secondary-500 text-xs font-medium uppercase">Streak</dt>
						<dd class="mt-1">
							<Player.Streak />
						</dd>
					</div>
				</dl>
			{/if}
		</div>
	</div>
</Player.Root>
