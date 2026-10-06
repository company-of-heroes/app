<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import Skeleton from '../ui/skeleton/skeleton.svelte';
	import { keyNumbersGrid, mapColumns } from './layout';

	type Props = {
		/** Which statistics component this stands in for. */
		part: 'keyNumbers' | 'maps' | 'factions' | 'matchups' | 'facts' | 'columns';
		rows?: number;
		compact?: boolean;
		class?: string;
	};

	let { part, rows = 5, compact = false, class: className }: Props = $props();
	const { t } = useI18n();

	const columns = $derived(mapColumns(compact));
	const items = $derived(Array.from({ length: rows }, (_, index) => index));
</script>

{#snippet line(height: string, width: string, bar = 'h-3')}
	<div class={cn('flex items-center', height)}>
		<Skeleton class={cn(bar, width)} />
	</div>
{/snippet}

<div class={className} aria-hidden="true">
	{#if part === 'keyNumbers'}
		<div class={keyNumbersGrid}>
			{#each [0, 1, 2, 3] as tile (tile)}
				<div class="px-4 py-3">
					{@render line('h-4', 'w-20', 'h-2.5')}
					<div class="mt-0.5">{@render line('h-7', 'w-16', 'h-5')}</div>
				</div>
			{/each}
		</div>
	{:else if part === 'maps'}
		<div class="overflow-x-auto text-sm">
			<div class={compact ? undefined : 'min-w-[38rem]'}>
				<div class={cn(tableHeadRow, 'grid items-center gap-3 px-4 py-2', columns)}>
					{#if !compact}
						<span>#</span>
					{/if}
					<span>{t('Map')}</span>
					<span class={compact ? 'text-right' : undefined}>{t('Played')}</span>
					{#if !compact}
						<span class="text-right">{t('Length')}</span>
					{/if}
					<span class="flex justify-between px-9">
						<span>{t('Allies')}</span>
						<span>{t('Axis')}</span>
					</span>
				</div>
				{#each items as item (item)}
					<div
						class={cn(
							'border-secondary-800 grid items-center gap-3 border-b px-4',
							compact ? 'py-1.5' : 'py-2',
							columns
						)}
					>
						{#if !compact}
							<span class="text-secondary-600 tabular-nums">{item + 1}</span>
						{/if}
						<div class="flex min-w-0 items-center gap-3">
							<Skeleton class="size-10 shrink-0 rounded" />
							<Skeleton class="h-3.5 w-32 max-w-full" />
						</div>
						<div class={cn('flex', compact && 'justify-end')}>
							<Skeleton class="h-3.5 w-10" />
						</div>
						{#if !compact}
							<div class="flex justify-end"><Skeleton class="h-3.5 w-12" /></div>
						{/if}
						<div class="flex items-center gap-2">
							<span class="w-7"></span>
							<Skeleton class="h-1 flex-1 rounded-full" />
							<span class="w-7"></span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if part === 'factions'}
		<div class="divide-secondary-800 divide-y">
			{#each [0, 1, 2, 3] as item (item)}
				<div class={cn('flex items-center gap-3', compact ? 'px-4 py-2' : 'px-4 py-3')}>
					<Skeleton class="size-5 shrink-0 rounded-full" />
					<div class="min-w-0 flex-1">
						{@render line('h-6', 'w-28', 'h-3.5')}
						{@render line('h-4', 'w-36', 'h-2.5')}
					</div>
					<div class="flex shrink-0 flex-col items-end">
						{@render line('h-6', 'w-12', 'h-4')}
						{#if !compact}
							{@render line('h-4', 'w-10', 'h-2.5')}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else if part === 'columns'}
		<div class="bg-secondary-800 grid gap-px sm:grid-cols-2 xl:grid-cols-4">
			{#each [0, 1, 2, 3] as column (column)}
				<div class="bg-gray-950">
					<div class="flex items-center gap-2 px-4 py-2.5">
						<Skeleton class="size-5 shrink-0 rounded-full" />
						{@render line('h-5', 'w-24', 'h-3.5')}
					</div>
					{#each items as item (item)}
						<div class="border-secondary-800 flex items-center gap-3 border-t px-4 py-2">
							<Skeleton class="size-8 shrink-0 rounded-sm" />
							<div class="min-w-0 flex-1">{@render line('h-5', 'w-28', 'h-3')}</div>
							<div class="flex flex-col items-end">
								{@render line('h-5', 'w-14', 'h-3.5')}
								{@render line('h-4', 'w-10', 'h-2.5')}
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{:else if part === 'matchups'}
		<div class="text-sm">
			<div class={cn(tableHeadRow, 'grid grid-cols-3 gap-3 px-4 py-2')}>
				<span>{t('Allies win vs')}</span>
				{@render line('h-4', 'w-24', 'h-2.5')}
				{@render line('h-4', 'w-24', 'h-2.5')}
			</div>
			{#each [0, 1] as item (item)}
				<div
					class="border-secondary-800 grid grid-cols-3 gap-3 border-b px-4 py-2.5 last:border-b-0"
				>
					{@render line('h-5', 'w-24', 'h-3.5')}
					{@render line('h-5', 'w-20', 'h-3.5')}
					{@render line('h-5', 'w-20', 'h-3.5')}
				</div>
			{/each}
		</div>
	{:else}
		<div class="divide-secondary-800 divide-y text-sm">
			{#each items as item (item)}
				<div class="flex items-center gap-3 px-4 py-2">
					<Skeleton class="size-[18px] shrink-0 rounded" />
					{@render line('h-5', 'w-24', 'h-3')}
					<div class="ml-auto">{@render line('h-5', 'w-28', 'h-3')}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
