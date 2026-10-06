<script lang="ts">
	import type { DocVeterancyRank } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import DocsEffects from './docs-effects.svelte';

	type Props = {
		ranks: DocVeterancyRank[];
	};

	let { ranks }: Props = $props();
	const host = useHost();
	const { t } = useI18n();
</script>

<ol class="divide-secondary-800 divide-y">
	{#each ranks as rank (rank.rank)}
		{@const icon = host.resolve.actionIcon(`veterancy_lv${rank.rank}`)}
		<li class="flex gap-3 py-3 first:pt-0 last:pb-0">
			{#if icon}
				<img src={icon} alt="" class="size-8 shrink-0" />
			{/if}
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-baseline gap-x-3">
					<h4 class="font-semibold text-white">{t('Veterancy {rank}', { rank: rank.rank })}</h4>
					{#if rank.experience}
						<span class="text-secondary-400 text-xs tabular-nums">
							{t('{xp} experience', { xp: rank.experience })}
						</span>
					{/if}
				</div>
				{#if rank.effects.length}
					<DocsEffects effects={rank.effects} class="mt-2" />
				{/if}
			</div>
		</li>
	{/each}
</ol>
