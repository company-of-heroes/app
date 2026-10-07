<script lang="ts">
	import type { DocModifier } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tryUseHost } from '../host/host.context';
	import { formatNumber } from '../docs/format';
	import EffectRows from './effect-rows.svelte';

	type Props = {
		ranks: { rank: number; experience?: number | null; effects: DocModifier[] }[];
		/** `sm` for popovers, `md` for full pages (the wiki). */
		size?: 'sm' | 'md';
		class?: string;
	};

	let { ranks, size = 'sm', class: className }: Props = $props();
	const { t } = useI18n();
	const host = tryUseHost();
</script>

<!-- Rank insignia with the experience it takes, next to what the rank gives. On full pages the
ranks share one grid, so the insignia column is only as wide as the widest insignia. -->
<ol
	class={cn(
		size === 'md' && 'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3',
		className
	)}
>
	{#each ranks as rank (rank.rank)}
		{@const icon = host?.resolve.actionIcon(`veterancy_lv${rank.rank}`)}
		<li
			class={size === 'md'
				? 'contents'
				: 'grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 py-2 last:pb-0'}
		>
			<div class={cn('flex flex-col items-start gap-1', size === 'md' ? 'pt-1.5' : 'pt-1')}>
				{#if icon && size === 'md'}
					<!-- The insignia art has a dark band on top; show only the bars. -->
					<span class="block h-2 overflow-hidden">
						<img
							src={icon}
							alt={t('Veterancy {rank}', { rank: rank.rank })}
							class="-mt-1 h-3 w-auto max-w-none"
						/>
					</span>
				{:else if icon}
					<img src={icon} alt={t('Veterancy {rank}', { rank: rank.rank })} class="h-2 w-auto" />
				{:else}
					<span class="text-xs font-semibold text-white">{rank.rank}</span>
				{/if}
				{#if rank.experience}
					<span
						class={cn(
							'tabular-nums',
							size === 'md' ? 'text-secondary-400 text-xs' : 'text-secondary-500 text-[10px]'
						)}
					>
						{t('{xp} XP', { xp: formatNumber(rank.experience, 0) })}
					</span>
				{/if}
			</div>
			<EffectRows
				effects={rank.effects}
				inline={size === 'md'}
				class={size === 'md' ? 'space-y-0 text-sm leading-snug' : undefined}
			/>
		</li>
	{/each}
</ol>
