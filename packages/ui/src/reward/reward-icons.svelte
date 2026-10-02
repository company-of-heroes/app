<script lang="ts">
	import { useHost } from '../host/host.context';
	import RewardIcon from './reward-icon.svelte';
	import type { PlayerRewards, RewardView } from './types';

	type Props = {
		/** Player whose rewards to show. */
		steamId: string;
		/** Preloaded by the host so the row does not pop in after render; fetched otherwise. */
		rewards?: PlayerRewards | null;
	};

	let { steamId, rewards: preloaded }: Props = $props();
	const host = useHost();

	/** Unlocked first (newest first); the owner also sees locked ones, closest first. Secret locked ones stay hidden. */
	function order(data: PlayerRewards | null): RewardView[] {
		if (!data) {
			return [];
		}

		const unlocked = data.rewards
			.filter((reward) => reward.unlockedAt)
			.sort((a, b) => Date.parse(b.unlockedAt ?? '') - Date.parse(a.unlockedAt ?? ''));
		const locked = data.owned
			? data.rewards
					.filter((reward) => !reward.unlockedAt && !reward.secret)
					.sort(
						(a, b) => (b.progress?.overall ?? 0) - (a.progress?.overall ?? 0) || a.sort - b.sort
					)
			: [];
		return [...unlocked, ...locked];
	}

	const fetched = $derived(
		preloaded === undefined
			? host.api.rewards
					.forPlayer(steamId)
					.catch(() => null)
					.then(order)
			: null
	);
</script>

{#snippet icons(list: RewardView[])}
	{#if list.length > 0}
		<div class="mb-4 flex flex-wrap items-center gap-1.5">
			{#each list as reward (reward.id)}
				<RewardIcon {reward} />
			{/each}
		</div>
	{/if}
{/snippet}

{#if fetched}
	{#await fetched then list}
		{@render icons(list)}
	{/await}
{:else}
	{@render icons(order(preloaded ?? null))}
{/if}
