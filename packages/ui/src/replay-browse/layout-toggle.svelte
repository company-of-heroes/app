<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { pageTab } from '@company-of-heroes/ui/variants';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBullets';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
	import { tooltip } from '../attachments/tooltip.svelte';
	import type { ReplayLayout } from '../replay/types';

	type Props = {
		value: ReplayLayout;
		onChange: (next: ReplayLayout) => void;
	};

	const { t } = useI18n();

	let { value, onChange }: Props = $props();

	const options = $derived([
		{ id: 'grid' as const, label: t('Grid view'), icon: SquaresFourIcon },
		{ id: 'list' as const, label: t('List view'), icon: ListBulletsIcon }
	]);
</script>

<div class="flex items-center gap-0.5" role="group" aria-label={t('Layout')}>
	{#each options as option (option.id)}
		{@const on = value === option.id}
		<button
			type="button"
			class={cn(pageTab, 'size-8 justify-center px-0')}
			data-state={on ? 'on' : undefined}
			aria-pressed={on}
			aria-label={option.label}
			{@attach tooltip(option.label)}
			onclick={() => onChange(option.id)}
		>
			<option.icon class="size-4" weight={on ? 'fill' : 'regular'} />
		</button>
	{/each}
</div>
