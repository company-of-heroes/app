<script lang="ts">
	import type { DocCost } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import MedalIcon from 'phosphor-svelte/lib/MedalIcon';
	import { tooltip } from '../attachments';
	import { useHost } from '../host/host.context';

	type Props = {
		cost?: DocCost;
		/** Population; shown with the pop cap icon. */
		pop?: number;
		/** Smaller icons and text for list rows. */
		compact?: boolean;
		class?: string;
	};

	let { cost, pop, compact = false, class: className }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const resources = $derived(
		[
			{ key: 'manpower', icon: 'resource_manpower', label: t('Manpower'), value: cost?.manpower },
			{ key: 'munition', icon: 'resource_munition', label: t('Munitions'), value: cost?.munition },
			{ key: 'fuel', icon: 'resource_fuel', label: t('Fuel'), value: cost?.fuel },
			{ key: 'pop', icon: 'resource_popcap', label: t('Population'), value: pop }
		].filter((resource) => resource.value)
	);
	const iconSize = $derived(compact ? 'size-4' : 'size-5');
</script>

<span
	class={cn(
		'inline-flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums',
		compact ? 'text-xs' : 'text-sm',
		className
	)}
>
	{#each resources as resource (resource.key)}
		<span class="inline-flex items-center gap-1" {@attach tooltip(resource.label)}>
			<img src={host.resolve.actionIcon(resource.icon)} alt={resource.label} class={iconSize} />
			{resource.value}
		</span>
	{/each}
	{#if cost?.command}
		<span class="inline-flex items-center gap-1" {@attach tooltip(t('Command points'))}>
			<MedalIcon class={cn('text-primary', iconSize)} weight="fill" />
			{cost.command}
		</span>
	{/if}
	{#if cost?.seconds}
		<span
			class="text-secondary-400 inline-flex items-center gap-1"
			{@attach tooltip(t('Build time'))}
		>
			<ClockIcon class={iconSize} />
			{t('{seconds}s', { seconds: cost.seconds })}
		</span>
	{/if}
</span>
