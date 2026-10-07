<script lang="ts">
	import { loadReplayStats, type ReplayStats } from '@company-of-heroes/game-data/replay';
	import { useI18n } from '@company-of-heroes/i18n';
	import ActionCostChips from './action-cost-chips.svelte';
	import type { ActionCost } from './replay-costs';

	type Props = {
		list: string;
		id: number;
		/** Cost from the blueprint tables; replaced by the call-in cost for doctrine call-in units. */
		cost: ActionCost | null;
		class?: string;
	};

	let { list, id, cost, class: className }: Props = $props();
	const { t } = useI18n();

	let stats = $state<ReplayStats>();
	$effect(() => {
		void loadReplayStats().then((table) => (stats = table));
	});

	const callIn = $derived(list === 'sbps' ? stats?.sbps[id]?.callIn : undefined);
</script>

{#if callIn}
	<div class={className}>
		<ActionCostChips cost={callIn.cost} />
		<p class="text-secondary-400 mt-1.5 text-xs font-normal">
			{t('Call-in')} <span class="text-secondary-500">·</span>
			{callIn.name}
		</p>
	</div>
{:else if cost}
	<ActionCostChips {cost} class={className} />
{/if}
