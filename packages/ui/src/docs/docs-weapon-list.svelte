<script lang="ts">
	import type { DocRef } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, interactive } from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useHost } from '../host/host.context';
	import DocsRefGrid from './docs-ref-grid.svelte';

	type Props = {
		weapons: DocRef[];
	};

	let { weapons }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	let search = $state('');

	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(
		query ? weapons.filter((weapon) => weapon.name.toLowerCase().includes(query)) : weapons
	);
</script>

<div class="border-secondary-800 border-b px-4 py-3">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
		<div class="flex items-center gap-4">
			<a
				href={host.href('/docs')}
				class={cn(
					interactive,
					'text-secondary-400 hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors'
				)}
			>
				<ArrowLeftIcon size={14} />
				{t('Documentation')}
			</a>
			<h1 class="font-heading text-xl font-bold text-white">{t('Weapons')}</h1>
		</div>
		<label class={cn(controlBase, 'flex w-full items-center sm:w-58')}>
			<MagnifyingGlassIcon class="text-secondary-500 ml-3 size-4 shrink-0" />
			<input
				type="search"
				placeholder={t('Search weapons...')}
				bind:value={search}
				class="placeholder:text-secondary-500 min-w-0 flex-1 bg-transparent px-3 text-sm text-white focus:outline-none"
			/>
		</label>
	</div>
</div>

<div class="p-4">
	{#if filtered.length}
		<DocsRefGrid refs={filtered} showCost={false} />
	{:else}
		<p class="text-secondary-400 text-sm">{t('Nothing matches your search.')}</p>
	{/if}
</div>
