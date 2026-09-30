<script lang="ts">
	import { useHost } from '../host/host.context';
	import RewardIcon from './reward-icon.svelte';
	import type { RewardView } from './types';

	type Props = {
		/** Player whose rewards to show. */
		steamId: string;
	};

	let { steamId }: Props = $props();
	const host = useHost();

	/** Unlocked first (newest first); the owner also sees locked ones, closest first. Secret locked ones stay hidden. */
	async function load(id: string): Promise<RewardView[]> {
		const data = await host.api.rewards.forPlayer(id).catch(() => null);
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

	const rewards = $derived(load(steamId));
</script>

{#await rewards then list}
	{#if list.length > 0}
		<div class="mb-4 flex flex-wrap items-center gap-1.5">
			{#each list as reward (reward.id)}
				<RewardIcon {reward} />
			{/each}
		</div>
	{/if}
{/await}
