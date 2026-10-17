<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { useHost } from '../host/host.context';
	import { parseDate } from '../format/date';
	import { interactive } from '../variants';
	import RewardIcon from './reward-icon.svelte';
	import {
		REWARD_CATEGORY_ORDER,
		rewardCategory,
		rewardCategoryLabel,
		ribbonSeriesMap,
		type RewardCategory
	} from './ribbon';
	import type { PlayerRewards, RewardView } from './types';

	type Props = {
		/** Player whose rewards to show. */
		steamId: string;
		/** Preloaded by the host so the row does not pop in after render; fetched otherwise. */
		rewards?: PlayerRewards | null;
		class?: string;
	};

	type Rack = { unlocked: RewardView[]; locked: RewardView[] };

	type CategoryGroup = { category: RewardCategory; label: string; rewards: RewardView[] };

	/** Locked rewards the owner sees before expanding: the closest ones. */
	const NEXT_UP = 3;

	let { steamId, rewards: preloaded, class: className }: Props = $props();
	const host = useHost();
	const { t } = useI18n();
	const ribbons = host.resolve.ribbons();
	const ribbonByKey = new Map(ribbons.map((ribbon) => [ribbon.key, ribbon]));
	const seriesOf = ribbonSeriesMap(ribbons);

	/**
	 * One ribbon per ranked series, like a real ribbon rack: the highest unlocked level
	 * (its devices show the level), or for locked ones the next level to earn.
	 */
	function collapseSeries(list: RewardView[], keep: 'highest' | 'lowest'): RewardView[] {
		const best: Record<string, RewardView> = {};
		const rest: RewardView[] = [];
		for (const reward of list) {
			const series = reward.ribbon ? seriesOf.get(reward.ribbon) : undefined;
			if (!series) {
				rest.push(reward);
				continue;
			}

			const current = best[series.series];
			const currentLevel = current?.ribbon ? (seriesOf.get(current.ribbon)?.level ?? 0) : 0;
			const better = keep === 'highest' ? series.level > currentLevel : series.level < currentLevel;
			if (!current || better) {
				best[series.series] = reward;
			}
		}

		return [...Object.values(best), ...rest];
	}

	/** Unlocked newest first; the owner also gets locked ones, closest first. Secret locked ones stay hidden. */
	function rack(data: PlayerRewards | null): Rack {
		if (!data) {
			return { unlocked: [], locked: [] };
		}

		const unlockedList = data.rewards.filter((reward) => reward.unlockedAt);
		const unlockedSeries = new Set(
			unlockedList.flatMap((reward) =>
				reward.ribbon && seriesOf.has(reward.ribbon)
					? [seriesOf.get(reward.ribbon)?.series ?? '']
					: []
			)
		);
		const unlocked = collapseSeries(unlockedList, 'highest').sort(
			(a, b) =>
				(parseDate(b.unlockedAt)?.getTime() ?? 0) - (parseDate(a.unlockedAt)?.getTime() ?? 0)
		);
		const locked = data.owned
			? collapseSeries(
					data.rewards.filter((reward) => !reward.unlockedAt && !reward.secret),
					'lowest'
				)
					// A series already in the rack: its next level is progress, not a new ribbon.
					.map((reward) => ({
						reward,
						started: Boolean(
							reward.ribbon && unlockedSeries.has(seriesOf.get(reward.ribbon)?.series ?? '')
						)
					}))
					.sort(
						(a, b) =>
							(b.reward.progress?.overall ?? 0) - (a.reward.progress?.overall ?? 0) ||
							Number(b.started) - Number(a.started) ||
							a.reward.sort - b.reward.sort
					)
					.map(({ reward }) => reward)
			: [];
		return { unlocked, locked };
	}

	/** Unlocked ribbons per category (factions, global, supporter), each group keeping its newest-first order. */
	function byCategory(list: RewardView[]): CategoryGroup[] {
		return REWARD_CATEGORY_ORDER.map((category) => ({
			category,
			label: t(rewardCategoryLabel(category)),
			rewards: list.filter(
				(reward) =>
					rewardCategory(reward, reward.ribbon ? ribbonByKey.get(reward.ribbon) : undefined) ===
					category
			)
		})).filter((group) => group.rewards.length > 0);
	}

	const fetched = $derived(
		preloaded === undefined
			? host.api.rewards
					.forPlayer(steamId)
					.catch(() => null)
					.then(rack)
			: null
	);
</script>

{#snippet icons({ unlocked, locked }: Rack)}
	{#if unlocked.length > 0 || locked.length > 0}
		<div class={cn('mb-4 flex max-w-[44rem] flex-col gap-3', className)}>
			{#if unlocked.length > 0}
				<ul class="flex flex-wrap gap-x-6 gap-y-3" aria-label={t('Rewards')}>
					{#each byCategory(unlocked) as group (group.category)}
						<li class="flex flex-col gap-1.5">
							<span class="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
								{group.label}
							</span>
							<ul class="flex flex-wrap items-center gap-1" aria-label={group.label}>
								{#each group.rewards as reward (reward.id)}
									<li class="flex"><RewardIcon {reward} /></li>
								{/each}
							</ul>
						</li>
					{/each}
				</ul>
			{/if}
			{#if locked.length > 0}
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
					<span class="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
						{t('Next')}
					</span>
					<ul class="flex flex-wrap items-center gap-1" aria-label={t('Locked')}>
						{#each locked.slice(0, NEXT_UP) as reward (reward.id)}
							<li class="flex"><RewardIcon {reward} /></li>
						{/each}
					</ul>
				</div>
			{/if}
			<a
				href={host.href(`/wiki/rewards?player=${steamId}`)}
				class={cn(
					interactive,
					'text-secondary-400 hover:text-primary w-fit text-xs transition-colors'
				)}
			>
				{t('Show details')}
			</a>
		</div>
	{/if}
{/snippet}

{#if fetched}
	{#await fetched then list}
		{@render icons(list)}
	{/await}
{:else}
	{@render icons(rack(preloaded ?? null))}
{/if}
