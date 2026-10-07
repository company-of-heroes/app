<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tooltip } from '../attachments/tooltip.svelte';

	type Props = {
		/** Phosphor icon component. */
		icon: Component<{ class?: string; weight?: 'fill' }>;
		/** Shown in the tooltip and for screen readers. */
		name: string;
		value: string | number | null | undefined;
		iconClass?: string;
		class?: string;
	};

	let {
		icon: Icon,
		name,
		value,
		iconClass = 'text-secondary-300',
		class: className
	}: Props = $props();
</script>

<!-- Icon-only stat: the name is in the tooltip and for screen readers. -->
{#if value !== null && value !== undefined && value !== ''}
	<span
		class={cn('bg-secondary-900 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5', className)}
		{@attach tooltip(name)}
	>
		<Icon class={cn('size-3.5 shrink-0', iconClass)} weight="fill" />
		<span class="sr-only">{name}</span>
		<span class="text-sm font-semibold text-white tabular-nums">{value}</span>
	</span>
{/if}
