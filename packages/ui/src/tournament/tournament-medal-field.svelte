<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		interactive,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { ToggleGroup } from '../ui/toggle-group';
	import { MEDAL_METALS } from './medal';

	type Props = {
		/** Medal key (e.g. `medal-042`), or null for the default medal. */
		value: string | null;
		disabled?: boolean;
	};

	let { value = $bindable(), disabled = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const medals = host.resolve.medals();
	const METAL_LABELS = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

	let open = $state(false);
	let metal = $state('all');

	const selected = $derived(medals.find((medal) => medal.key === value) ?? null);
	const visible = $derived(
		metal === 'all' ? medals : medals.filter((medal) => medal.metal === metal)
	);
	const metalItems = $derived([
		{ value: 'all', label: t('All') },
		...MEDAL_METALS.map((value) => ({ value, label: t(METAL_LABELS[value]) }))
	]);

	function choose(key: string) {
		value = key;
		open = false;
	}
</script>

<div class="flex items-start gap-4">
	<div
		class="border-secondary-800 bg-secondary-950 flex h-28 w-20 shrink-0 items-center justify-center rounded-md border"
	>
		{#if selected}
			<img src={selected.url} alt={selected.title} class="h-24 w-auto" />
		{:else}
			<span class="text-secondary-500 px-2 text-center text-xs">{t('Default medal')}</span>
		{/if}
	</div>
	<div class="flex flex-col items-start gap-2">
		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="secondary"
				size="sm"
				disabled={disabled || medals.length === 0}
				onclick={() => (open = true)}
			>
				{selected ? t('Change medal') : t('Choose medal')}
			</Button>
			{#if selected}
				<Button type="button" variant="ghost" size="sm" {disabled} onclick={() => (value = null)}>
					{t('Use default')}
				</Button>
			{/if}
		</div>
		{#if selected}
			<p class="text-secondary-300 text-sm">{selected.title}</p>
		{/if}
	</div>
</div>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 flex max-h-[calc(100vh-6rem)] w-[720px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{t('Champion medal')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{t('The winner gets this medal on their profile.')}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={t('Close')}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</Dialog.Title>
			<div class="border-secondary-800 border-b px-4 py-2">
				<ToggleGroup bind:value={metal} items={metalItems} aria-label={t('Metal')} />
			</div>
			<ul class="grid grid-cols-4 gap-1 overflow-y-auto p-3 sm:grid-cols-6 md:grid-cols-8">
				{#each visible as medal (medal.key)}
					<li>
						<button
							type="button"
							title={medal.title}
							aria-label={medal.title}
							aria-pressed={medal.key === value}
							onclick={() => choose(medal.key)}
							class={cn(
								interactive,
								'hover:bg-secondary-800/60 flex w-full justify-center rounded-md border py-2 transition-colors',
								medal.key === value ? 'border-warning bg-warning/10' : 'border-transparent'
							)}
						>
							<img src={medal.url} alt="" loading="lazy" class="h-24 w-auto" />
						</button>
					</li>
				{/each}
			</ul>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
