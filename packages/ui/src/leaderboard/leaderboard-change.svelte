<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import type { LeaderboardRankChange } from '../format/types';
	import { tooltip } from '../attachments';

	type Props = {
		/** Undefined/null: no snapshot to compare against, shows a dash. */
		change: LeaderboardRankChange | null | undefined;
		period?: 'day' | 'week';
		class?: string;
	};

	const { t } = useI18n();

	let { change, period = 'day', class: className }: Props = $props();

	const hint = $derived(period === 'week' ? t('Since last week') : t('Since yesterday'));
</script>

{#if change === null || change === undefined || change.rank === 0}
	<span class={cn('text-secondary-600 tabular-nums', className)} aria-hidden="true">–</span>
{:else if change.rank === null}
	<span
		class={cn('text-primary text-[0.65rem] font-bold tracking-wider uppercase', className)}
		{@attach tooltip(hint)}
	>
		{t('New')}
	</span>
{:else}
	<span
		class={cn(
			'inline-flex items-center gap-0.5 font-semibold tabular-nums',
			change.rank > 0 ? 'text-green-300' : 'text-red-300',
			className
		)}
		{@attach tooltip(hint)}
	>
		{#if change.rank > 0}
			<CaretUpIcon class="size-3" weight="fill" />
			<span class="sr-only">{t('Up')}</span>
		{:else}
			<CaretDownIcon class="size-3" weight="fill" />
			<span class="sr-only">{t('Down')}</span>
		{/if}
		{Math.abs(change.rank)}
	</span>
{/if}
