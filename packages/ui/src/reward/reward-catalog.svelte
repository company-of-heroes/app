<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import { cn } from '../cn';
	import DocsBreadcrumb from '../docs/docs-breadcrumb.svelte';
	import { formatDate } from '../format/date';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { ToggleGroup } from '../ui/toggle-group';
	import { controlBase, flushHeader, flushHeaderTitle, interactive } from '../variants';
	import { catalogEntries, REWARD_FACTION_ORDER, type CatalogEntry } from './catalog';
	import {
		formatRewardCondition,
		REWARD_METRIC_CATALOG,
		rewardConditionKey,
		type RewardCondition
	} from './metrics';
	import RewardIcon from './reward-icon.svelte';
	import type { PlayerRewards, RewardView } from './types';

	/** Locked rewards of the owner carry the current value per condition. */
	type ShownCondition = RewardCondition & { value?: number };

	type Props = {
		/** Every enabled reward (secret ones blank). */
		rewards: RewardView[];
		/** Shows what this player unlocked, and the owner's progress. */
		player?: { steamId: string; name: string; rewards: PlayerRewards } | null;
	};

	const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

	let { rewards, player = null }: Props = $props();
	const host = useHost();
	const { t } = useI18n();
	const ribbons = host.resolve.ribbons();

	let faction = $state('all');
	let search = $state('');

	const factionKey = (raceId: number | null) => (raceId === null ? 'global' : String(raceId));
	const factionLabel = (raceId: number | null) =>
		raceId === null ? t('Global') : t(getRaceLabel(raceId));
	const factions = $derived([
		{ value: 'all', label: t('All') },
		...REWARD_FACTION_ORDER.map((raceId) => ({
			value: factionKey(raceId),
			label: factionLabel(raceId)
		}))
	]);
	const entries = $derived(catalogEntries(rewards, player?.rewards ?? null, ribbons));
	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(
		entries.filter(
			(entry) =>
				(faction === 'all' || factionKey(entry.raceId) === faction) &&
				(!query ||
					rewardsOf(entry).some((reward) =>
						`${reward.title} ${reward.description}`.toLowerCase().includes(query)
					))
		)
	);
	const sections = $derived(
		REWARD_FACTION_ORDER.map((raceId) => ({
			raceId,
			entries: filtered.filter((entry) => entry.raceId === raceId)
		})).filter((section) => section.entries.length > 0)
	);
	const total = $derived(entries.flatMap(rewardsOf).length);
	const unlocked = $derived(
		entries.flatMap(rewardsOf).filter((reward) => reward.unlockedAt).length
	);

	function rewardsOf(entry: CatalogEntry): RewardView[] {
		return entry.kind === 'single' ? [entry.reward] : entry.levels;
	}

	function conditionsOf(reward: RewardView): ShownCondition[] {
		const progress = new Map(
			(reward.progress?.conditions ?? []).map(
				(condition) => [rewardConditionKey(condition), condition] as const
			)
		);
		return reward.conditions.map(
			(condition): ShownCondition => progress.get(rewardConditionKey(condition)) ?? condition
		);
	}

	function amount(condition: ShownCondition, done: boolean): string {
		if (REWARD_METRIC_CATALOG[condition.metric]?.boolean) {
			return '';
		}

		return done || condition.value === undefined
			? String(condition.threshold)
			: `${Math.min(condition.value, condition.threshold)} / ${condition.threshold}`;
	}

	/** Unlock date, or the owner's progress on a locked reward. */
	function status(reward: RewardView): string {
		if (reward.unlockedAt) {
			return formatDate(reward.unlockedAt, host.locale());
		}

		return reward.progress ? `${Math.floor(reward.progress.overall * 100)}%` : '';
	}

	/** Hover text of a level badge: its title, what it takes, and the unlock date or progress. */
	function levelTip(level: RewardView): string {
		const lines = conditionsOf(level).map(
			(condition) =>
				`${escapeHtml(formatRewardCondition(condition, t))} ${amount(condition, Boolean(level.unlockedAt))}`
		);
		const state = level.unlockedAt
			? status(level)
			: player
				? t('Locked · {percent}%', {
						percent: Math.floor((level.progress?.overall ?? 0) * 100)
					})
				: '';
		return `<span class="block max-w-64">${[
			`<span class="block font-semibold text-white">${escapeHtml(level.title)}</span>`,
			level.description
				? `<span class="text-secondary-300 mt-0.5 block">${escapeHtml(level.description)}</span>`
				: '',
			...lines.map((line) => `<span class="text-secondary-300 mt-0.5 block">${line}</span>`),
			state
				? `<span class="text-secondary-500 mt-1.5 block text-xs">${escapeHtml(state)}</span>`
				: ''
		].join('')}</span>`;
	}
</script>

{#snippet conditions(reward: RewardView, withAmount: boolean)}
	{#if reward.conditions.length > 0}
		<ul class="mt-1.5 flex flex-col gap-0.5 text-xs">
			{#each conditionsOf(reward) as condition (rewardConditionKey(condition))}
				<li class="flex items-baseline justify-between gap-3">
					<span class="text-secondary-300 min-w-0">{formatRewardCondition(condition, t)}</span>
					{#if withAmount}
						<span class="text-secondary-100 shrink-0 font-semibold tabular-nums">
							{amount(condition, Boolean(reward.unlockedAt))}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet single(reward: RewardView)}
	{@const faded = Boolean(player) && !reward.unlockedAt}
	<div class="flex items-center gap-3">
		<RewardIcon {reward} locked={faded} />
		<span class="text-secondary-500 ml-auto shrink-0 text-xs tabular-nums">{status(reward)}</span>
	</div>
	<div class={cn('min-w-0', faded && 'opacity-60')}>
		<span class="block truncate font-semibold text-white">{reward.title}</span>
		{#if reward.description}
			<p class="text-secondary-400 mt-0.5 text-xs">{reward.description}</p>
		{/if}
		{@render conditions(reward, true)}
	</div>
{/snippet}

{#snippet series(name: string, levels: RewardView[])}
	{@const reached = levels.filter((level) => level.unlockedAt)}
	{@const shown = reached.at(-1) ?? levels[0]}
	{@const next = levels.find((level) => !level.unlockedAt)}
	{@const faded = Boolean(player) && reached.length === 0}
	<div class="flex items-center gap-3">
		<RewardIcon reward={shown} locked={faded} />
		{#if reached.length > 0}
			<Badge variant="success" class="shrink-0">
				{t('Level {level} of {levels}', { level: reached.length, levels: levels.length })}
			</Badge>
		{/if}
		<span class="text-secondary-500 ml-auto shrink-0 text-xs tabular-nums">
			{reached.length > 0 ? status(shown) : next ? status(next) : ''}
		</span>
	</div>
	<div class={cn('min-w-0', faded && 'opacity-60')}>
		<span class="block truncate font-semibold text-white">{name || shown.title}</span>
		{@render conditions(levels[0], false)}
		<ol class="mt-2 flex flex-wrap gap-1" aria-label={t('Levels')}>
			{#each levels as level, index (level.id)}
				<li>
					<Badge
						variant={level.unlockedAt ? 'success' : 'default'}
						class="tabular-nums"
						{@attach tooltip(levelTip(level), { delay: [100, null] })}
					>
						{NUMERALS[index] ?? index + 1}
						<span class="text-secondary-400">{level.conditions[0]?.threshold ?? ''}</span>
					</Badge>
				</li>
			{/each}
			{#if next?.progress && next.progress.conditions[0]}
				{@const progress = next.progress.conditions[0]}
				<li class="text-secondary-300 self-center pl-1 text-xs font-semibold tabular-nums">
					{Math.min(progress.value, progress.threshold)} / {progress.threshold}
				</li>
			{/if}
		</ol>
	</div>
{/snippet}

<DocsBreadcrumb current={t('Rewards')} />

<div class="border-secondary-800 border-b px-4 py-6">
	<h1 class="font-heading text-3xl font-bold text-white">{t('Rewards')}</h1>
	<p class="text-secondary-400 mt-2 max-w-3xl text-sm leading-relaxed">
		{t(
			'Every ribbon you can earn and what unlocks it. Ribbons with levels go up as you reach each step; the edge stripes show the faction.'
		)}
	</p>
	{#if player}
		<div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
			<span class="text-secondary-300">
				{t('Rewards of')}
				<a
					href={host.routes.player(player.steamId)}
					class={cn(interactive, 'hover:text-primary font-semibold text-white')}
				>
					{player.name}
				</a>
			</span>
			<Badge variant="success">
				{t('{unlocked} of {total} unlocked', { unlocked, total })}
			</Badge>
			<a
				href={host.href('/wiki/rewards?player=')}
				aria-label={t('Show all rewards')}
				class={cn(interactive, 'text-secondary-400 hover:text-primary inline-flex')}
			>
				<XIcon size={16} />
			</a>
		</div>
	{/if}
	<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
		<ToggleGroup bind:value={faction} items={factions} variant="tabs" aria-label={t('Faction')} />
		<label class={cn(controlBase, 'flex w-full items-center sm:w-58')}>
			<MagnifyingGlassIcon class="text-secondary-500 ml-3 size-4 shrink-0" />
			<input
				type="search"
				placeholder={t('Search rewards...')}
				bind:value={search}
				class="placeholder:text-secondary-500 min-w-0 flex-1 bg-transparent px-3 text-sm text-white focus:outline-none"
			/>
		</label>
	</div>
</div>

{#if sections.length > 0}
	<!-- Cards close themselves; the last row sits a pixel over the footer's top border. -->
	<div class="-mb-px">
		{#each sections as section (factionKey(section.raceId))}
			<section>
				<div class={cn(flushHeader, 'flex items-baseline justify-between gap-3')}>
					<h2 class={flushHeaderTitle}>{factionLabel(section.raceId)}</h2>
					<p class="text-secondary-500 text-xs">
						{t('{count} rewards', { count: section.entries.flatMap(rewardsOf).length })}
					</p>
				</div>
				<!-- Cards draw their right and bottom line; the wrapper clips the right edge. -->
				<div class="overflow-hidden">
					<ul class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
						{#each section.entries as entry (entry.key)}
							<li class="border-secondary-800 flex min-w-0 flex-col gap-2 border-r border-b p-4">
								{#if entry.kind === 'single'}
									{@render single(entry.reward)}
								{:else}
									{@render series(entry.name, entry.levels)}
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			</section>
		{/each}
	</div>
{:else}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('Nothing matches your search.')}</p>
{/if}
