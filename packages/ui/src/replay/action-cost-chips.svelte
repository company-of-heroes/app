<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';
	import ClockIcon from 'phosphor-svelte/lib/Clock';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { tryUseHost } from '../host/host.context';
	import { RESOURCE_COLOURS, type ActionCost } from './replay-costs';

	type Props = {
		cost: ActionCost & { refunded?: boolean };
		class?: string;
	};

	let { cost, class: className }: Props = $props();
	const host = tryUseHost();
	const { t } = useI18n();

	const RESOURCES = ['manpower', 'fuel', 'munition', 'popcap'] as const;
	const LABELS = {
		manpower: 'Manpower',
		fuel: 'Fuel',
		munition: 'Munitions',
		popcap: 'Population'
	} as const;
	const icons = Object.fromEntries(
		RESOURCES.map((resource) => [resource, host?.resolve.actionIcon(`resource_${resource}`)])
	);
	const formatAmount = (value: number) => Math.round(value).toLocaleString();
</script>

<div class={cn('flex flex-wrap items-center gap-1.5', className)}>
	{#each RESOURCES as resource (resource)}
		{#if cost[resource]}
			<span
				class={cn(
					'bg-secondary-900 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-semibold tabular-nums',
					cost.refunded && 'line-through opacity-60'
				)}
				style:color={RESOURCE_COLOURS[resource]}
				{@attach tooltip(t(LABELS[resource]))}
			>
				{#if icons[resource]}
					<img src={icons[resource]} alt={t(LABELS[resource])} class="size-4" />
				{/if}
				{formatAmount(cost[resource]!)}
			</span>
		{/if}
	{/each}
	{#if cost.command}
		<span
			class="bg-secondary-900 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm tabular-nums"
			{@attach tooltip(t('Command points'))}
		>
			<span class="text-[10px] font-bold text-yellow-300">CP</span>
			{formatAmount(cost.command)}
		</span>
	{/if}
	{#if cost.seconds}
		<span
			class="text-secondary-400 inline-flex items-center gap-1 text-xs tabular-nums"
			{@attach tooltip(t('Build time'))}
		>
			<ClockIcon class="size-3.5" />
			{Math.round(cost.seconds)}s
		</span>
	{/if}
</div>
