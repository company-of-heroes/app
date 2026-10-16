<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { escapeHtml, tooltip } from '../attachments';
	import { formatDate } from '../format/date';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { LEADERBOARD_MODES } from '../leaderboard/modes';
	import CountryFlag from '../player/country-flag.svelte';
	import PlayerLabels from '../player/player-labels.svelte';
	import type { PlayerCardData, PlayerCardFaction } from './types';

	type Props = {
		card: PlayerCardData;
		class?: string;
	};

	let { card, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const ribbonByKey = new Map(host.resolve.ribbons().map((ribbon) => [ribbon.key, ribbon]));
	const medalUrl = host.resolve.supporterMedal();

	const avatar = $derived(card.avatarUrl ? host.resolve.avatarUrl(card.avatarUrl) : null);
	const initial = $derived((card.alias.trim()[0] ?? '?').toUpperCase());
	const months = $derived(
		card.supporterMonths === 1
			? t('Supporter for 1 month')
			: t('Supporter for {count} months', { count: card.supporterMonths })
	);
	const since = $derived(
		card.supporterSince ? formatDate(card.supporterSince, host.locale()) : null
	);
	const ribbons = $derived(
		card.ribbons.flatMap((ribbon) => {
			const known = ribbonByKey.get(ribbon.key);
			return known ? [{ key: ribbon.key, url: known.url, title: ribbon.title }] : [];
		})
	);

	function modeLabel(leaderboardId: number | null): string | null {
		return (
			LEADERBOARD_MODES.find(
				(mode) =>
					leaderboardId !== null && leaderboardId >= mode.value && leaderboardId < mode.value + 4
			)?.label ?? null
		);
	}

	function ranked(faction: PlayerCardFaction): boolean {
		return faction.elo !== null || faction.rank !== null;
	}
</script>

<!-- The supporter player card: the same content as the PNG, as HTML. -->
<article
	class={cn('border-secondary-800 border-t-primary border border-t-4 bg-gray-950', className)}
>
	<header class="flex items-center gap-5 p-5 sm:gap-8 sm:p-8">
		{#if avatar}
			<img
				src={avatar}
				alt={card.alias}
				class="border-primary size-20 shrink-0 rounded-md border-2 object-cover sm:size-32"
			/>
		{:else}
			<span
				aria-hidden="true"
				class="border-primary text-primary bg-secondary-950 flex size-20 shrink-0 items-center justify-center rounded-md border-2 text-4xl font-extrabold sm:size-32 sm:text-6xl"
			>
				{initial}
			</span>
		{/if}
		<div class="flex min-w-0 flex-col gap-2">
			<p class="text-primary flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
				{#if medalUrl}
					<img src={medalUrl} alt="" width={11} height={20} class="shrink-0" />
				{/if}
				{months}
			</p>
			<h1 class="flex min-w-0 items-center gap-3 text-3xl leading-tight sm:text-5xl">
				<span class="truncate">{card.alias}</span>
				<CountryFlag country={card.country} class="h-5" />
			</h1>
			<PlayerLabels labels={card.labels} />
		</div>
	</header>
	<div class="border-secondary-800 -mb-px overflow-hidden border-t">
		<ul class="-mr-px grid grid-cols-2 sm:grid-cols-4">
			{#each card.factions as faction (faction.raceId)}
				{@const mode = modeLabel(faction.leaderboardId)}
				<li class="border-secondary-800 flex min-w-0 flex-col gap-2 border-r border-b p-4 sm:p-5">
					<span class="text-secondary-300 flex items-center gap-2 text-sm">
						<img
							src={host.resolve.factionFlagByRace(faction.raceId)}
							alt=""
							class="h-4 w-auto shrink-0 rounded-xs"
						/>
						<span class="truncate">{getRaceLabel(faction.raceId)}</span>
					</span>
					{#if ranked(faction)}
						<span class="flex items-center gap-2 text-2xl font-extrabold text-white">
							{#if faction.leaderboardId !== null && faction.rankLevel !== null}
								<img
									src={host.resolve.rankImageByLeaderboard(
										faction.leaderboardId,
										faction.rankLevel
									)}
									alt=""
									class="size-7 shrink-0 object-contain"
								/>
							{/if}
							{faction.elo !== null
								? `${faction.elo} ELO`
								: t('#{rank}', { rank: faction.rank ?? 0 })}
						</span>
						<span class="text-secondary-400 text-sm">
							{#if faction.elo === null}
								{mode ?? ''}
							{:else if faction.rank !== null}
								{t('#{rank}', { rank: faction.rank })}{mode ? ` · ${mode}` : ''}
							{:else}
								{t('No ladder rank')}
							{/if}
						</span>
					{:else}
						<span class="text-secondary-400 text-2xl font-extrabold">{t('Unranked')}</span>
						<span class="text-secondary-400 text-sm">{t('No ranked games')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<footer
		class="border-secondary-800 flex flex-wrap items-center justify-between gap-4 border-t p-5 sm:px-8"
	>
		<div class="flex flex-col gap-1">
			<p class="text-lg font-bold text-white">
				{#if card.winRate !== null}
					{t('{rate}% win rate', { rate: Math.round(card.winRate * 100) })} · {t(
						'{count} ranked games',
						{ count: card.matches }
					)}
				{:else}
					{t('Unranked')}
				{/if}
			</p>
			{#if since}
				<p class="text-secondary-400 text-sm">{t('Supporter since {date}', { date: since })}</p>
			{/if}
		</div>
		{#if ribbons.length > 0}
			<ul class="flex flex-wrap items-center gap-2">
				{#each ribbons as ribbon (ribbon.key)}
					<li {@attach tooltip(escapeHtml(ribbon.title))}>
						<img
							src={ribbon.url}
							alt={ribbon.title}
							width={70}
							height={20}
							class="block h-5 w-[70px] rounded-[2px] shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</footer>
</article>
