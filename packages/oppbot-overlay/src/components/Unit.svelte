<script lang="ts">
	import {
		FACTION,
		formatRankLevel,
		formatRanking,
		formatStreak,
		getCombatRecord,
		getFlagImage,
		getRaceImage,
		getRankImage
	} from '../lib/lobby';
	import type { Player } from '../lib/types';

	interface Props {
		player: Player;
		matchType: number;
		teamIndex: number;
		isMe?: boolean;
	}

	let { player, matchType, teamIndex, isMe = false }: Props = $props();

	const alias = $derived(player.profile?.alias ?? 'CPU');
	const country = $derived(player.profile?.country);
	const rec = $derived(getCombatRecord(matchType, player));
	const streak = $derived(formatStreak(rec.streak));
</script>

<article class="unit side-{teamIndex}" class:unit--self={isMe}>
	<div class="unit__seal">
		<div class="unit__seal-col unit__seal-col--rank">
			{#if country}
				<img class="unit__flag" src={getFlagImage(country)} alt={country} />
			{:else}
				<div class="unit__rank-stack">
					<img class="unit__rank" src={getRankImage(matchType, player)} alt="" />
					<span class="unit__level">{formatRankLevel(matchType, player)}</span>
				</div>
			{/if}
		</div>
		{#if country}
			<div class="unit__seal-col unit__seal-col--flag">
				<div class="unit__rank-stack">
					<img class="unit__rank" src={getRankImage(matchType, player)} alt="" />
					<span class="unit__level">{formatRankLevel(matchType, player)}</span>
				</div>
			</div>
		{/if}
	</div>

	<div class="unit__panel">
		<div class="unit__primary">
			<span class="unit__name" title={alias}>{alias}</span>
			<span class="unit__scores">
				<span class="unit__ranking">{formatRanking(player.ranking)}</span>
				<span class="unit__elo" class:unit__elo--na={rec.elo === 'NA'}>
					{rec.elo === 'NA' ? 'NA' : `${rec.elo} ELO`}
				</span>
			</span>
		</div>

		<div class="unit__secondary">
			<span class="unit__faction">
				<img src={getRaceImage(player.race)} alt="" />
				{FACTION[player.race]}
			</span>
			<span class="unit__record">
				<span class="unit__w">{rec.wins}W</span>
				<span class="unit__l">{rec.losses}L</span>
				{#if rec.winRate !== null}
					<span class="unit__wr">{rec.winRate}%</span>
				{/if}
				{#if streak}
					<span
						class="unit__streak"
						class:unit__streak--up={rec.streak > 0}
						class:unit__streak--down={rec.streak < 0}
					>
						{streak}
					</span>
				{/if}
			</span>
		</div>
	</div>
</article>
