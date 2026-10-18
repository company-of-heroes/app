<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, flushHeaderTitle } from '@company-of-heroes/ui/variants';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import { escapeHtml, tooltip } from '../attachments';
	import { formatDate } from '../format/date';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import LeaderboardRecord from '../leaderboard/leaderboard-record.svelte';
	import { LEADERBOARD_MODES } from '../leaderboard/modes';
	import CountryFlag from '../player/country-flag.svelte';
	import PlayerLabels from '../player/player-labels.svelte';
	import RankIcon from '../player/rank-icon.svelte';
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
	/** The army with the highest ELO gets the crown; none when nothing is ranked. */
	const best = $derived.by(() => {
		let top: PlayerCardFaction | null = null;
		for (const faction of card.factions) {
			if (faction.elo !== null && (top === null || faction.elo > (top.elo ?? 0))) {
				top = faction;
			}
		}

		return top;
	});
	/** Ranked record for the win-loss bar; the counts follow the stored win rate. */
	const wins = $derived(card.winRate === null ? 0 : Math.round(card.winRate * card.matches));
	const losses = $derived(card.winRate === null ? 0 : card.matches - wins);

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

<!-- The supporter player card; the website draws its PNG from this markup. Sizes follow the
card's own width (container queries), so a fixed-size copy looks the same on any screen. -->
<article class={cn('border-secondary-800 @container border bg-gray-950', className)}>
	<header class="border-secondary-800 relative isolate overflow-hidden border-b">
		<div
			class="from-primary/15 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_12%_0%] via-transparent to-transparent"
		></div>
		<span
			class="text-secondary-500 absolute top-4 right-5 text-xs font-semibold tracking-wide @xl:top-5 @xl:right-8"
		>
			coh1stats.com
		</span>
		<div class="flex h-full items-center gap-5 p-5 @xl:gap-7 @xl:px-8 @xl:py-7">
			<div class="relative shrink-0">
				{#if avatar}
					<img
						src={avatar}
						alt={card.alias}
						class="ring-primary/60 size-24 rounded-xl object-cover ring-2 ring-offset-2 ring-offset-gray-950 @xl:size-32"
					/>
				{:else}
					<span
						aria-hidden="true"
						class="bg-secondary-800 text-primary ring-primary/60 flex size-24 items-center justify-center rounded-xl text-5xl font-extrabold ring-2 ring-offset-2 ring-offset-gray-950 @xl:size-32 @xl:text-6xl"
					>
						{initial}
					</span>
				{/if}
				{#if medalUrl}
					<img
						src={medalUrl}
						alt=""
						width={64}
						height={116}
						class="absolute -right-3 -bottom-3 h-12 w-auto drop-shadow-md @xl:h-14"
					/>
				{/if}
			</div>
			<div class="flex min-w-0 flex-col gap-2">
				<p class={cn(flushHeaderTitle, 'flex items-center gap-2')}>
					<CountryFlag country={card.country} class="h-4" />
					<span class="text-primary">{months}</span>
				</p>
				<h1
					class="font-heading text-primary truncate text-4xl leading-tight font-bold drop-shadow-md @xl:text-5xl"
				>
					{card.alias}
				</h1>
				<PlayerLabels labels={card.labels} />
			</div>
		</div>
	</header>
	<div class="border-secondary-800 -mb-px overflow-hidden border-b">
		<ul class="-mr-px grid grid-cols-2 @xl:grid-cols-4">
			{#each card.factions as faction (faction.raceId)}
				{@const mode = modeLabel(faction.leaderboardId)}
				{@const crowned = faction === best}
				<li
					class={cn(
						'border-secondary-800 flex min-w-0 flex-col gap-2 border-r border-b p-4 @xl:p-5',
						crowned && 'from-primary/[0.12] bg-linear-to-b to-transparent'
					)}
				>
					<span
						class={cn(
							'flex items-center gap-2 text-sm',
							crowned ? 'text-primary' : 'text-secondary-300'
						)}
					>
						<img src={host.resolve.factionFlagByRace(faction.raceId)} alt="" class={factionIcon} />
						<span class="truncate">{getRaceLabel(faction.raceId)}</span>
						{#if crowned}
							<CrownIcon class="text-primary ms-auto size-4 shrink-0" weight="duotone" />
						{/if}
					</span>
					{#if ranked(faction)}
						<span
							class={cn(
								'font-heading flex items-center gap-2 text-2xl font-bold tabular-nums @xl:text-3xl',
								crowned ? 'text-primary' : 'text-white'
							)}
						>
							{#if faction.leaderboardId !== null && faction.rankLevel !== null}
								<RankIcon
									level={faction.rankLevel}
									leaderboardId={faction.leaderboardId}
									position={faction.rank}
									class="size-auto h-8 drop-shadow"
								/>
							{/if}
							{#if faction.elo !== null}
								{faction.elo}
								<span class="text-secondary-400 text-sm font-normal">ELO</span>
							{:else}
								{t('#{rank}', { rank: faction.rank ?? 0 })}
							{/if}
						</span>
						{#if faction.elo === null}
							<span class="text-secondary-400 text-sm">{mode ?? ''}</span>
						{:else if faction.rank !== null}
							<span class="text-secondary-400 text-sm">
								{t('#{rank}', { rank: faction.rank })}{mode ? ` · ${mode}` : ''}
							</span>
						{/if}
					{:else}
						<span class="font-heading text-secondary-500 text-2xl font-bold @xl:text-3xl">
							{t('Unranked')}
						</span>
						<span class="text-secondary-500 text-sm">{t('No ranked games')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<footer class="flex flex-wrap items-center justify-between gap-4 p-5 @xl:px-8">
		<div class="flex min-w-0 flex-col gap-1.5">
			{#if card.winRate !== null}
				<LeaderboardRecord {wins} {losses} compact class="w-56" />
				<p class="text-secondary-400 text-sm">
					{t('{count} ranked games', { count: card.matches })}
				</p>
			{:else}
				<p class="font-heading text-secondary-500 text-lg font-bold">{t('Unranked')}</p>
				<p class="text-secondary-500 text-sm">{t('No ranked games')}</p>
			{/if}
		</div>
		<div class="flex flex-col items-end gap-1.5">
			{#if ribbons.length > 0}
				<ul class="flex flex-wrap items-center justify-end gap-2">
					{#each ribbons as ribbon (ribbon.key)}
						<li {@attach tooltip(escapeHtml(ribbon.title))}>
							<img
								src={ribbon.url}
								alt={ribbon.title}
								width={84}
								height={24}
								class="block h-6 w-[84px] rounded-[2px] shadow-[0_1px_3px_rgb(0_0_0/0.7)]"
							/>
						</li>
					{/each}
				</ul>
			{/if}
			{#if since}
				<p class="text-secondary-500 text-xs">{t('Supporter since {date}', { date: since })}</p>
			{/if}
		</div>
	</footer>
</article>
