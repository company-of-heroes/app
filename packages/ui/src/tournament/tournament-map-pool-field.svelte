<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack } from 'svelte';
	import { resource } from 'runed';
	import { Dialog } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import { BUILT_IN_MAPS, TOURNAMENT_MAP_ICON_MAX_BYTES } from '@company-of-heroes/api/tournaments';
	import { WORKSHOP_MAPS } from '@company-of-heroes/game-data/maps';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { normalizeMapName } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { Input, Selection } from '../ui/input';
	import { Label } from '../ui/label';
	import TournamentImageField from './tournament-image-field.svelte';
	import TournamentMapThumb from './tournament-map-thumb.svelte';
	import type { TournamentMap } from './types';

	type Props = {
		/** Map references in pool order. */
		value: string[];
		/** The tournament's resolved pool, so custom maps show before the list has loaded. */
		initial?: TournamentMap[];
		disabled?: boolean;
	};

	let { value = $bindable([]), initial = [], disabled = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const builtIn: TournamentMap[] = [
		...BUILT_IN_MAPS.map(
			(ref): TournamentMap => ({
				ref,
				name: normalizeMapName(ref),
				imageUrl: null,
				source: 'stock'
			})
		),
		...WORKSHOP_MAPS.map(
			(map): TournamentMap => ({ ref: map.key, name: map.name, imageUrl: null, source: 'workshop' })
		)
	];
	const SOURCE_ORDER = { custom: 0, stock: 1, workshop: 2 } as const;

	const customMaps = resource(
		() => true,
		() => host.api.tournaments.listMaps()
	);
	let added = $state<TournamentMap[]>([]);
	let pickerOpen = $state(false);
	let createOpen = $state(false);
	let newName = $state('');
	let newIcon = $state<File | null>(null);
	let newIconClear = $state(false);
	let creating = $state(false);

	const known = $derived(
		new Map(
			[...untrack(() => initial), ...builtIn, ...(customMaps.current ?? []), ...added].map(
				(map) => [map.ref, map]
			)
		)
	);
	const selected = $derived(
		value.map((ref) => known.get(ref)).filter((map): map is TournamentMap => Boolean(map))
	);
	const options = $derived(
		[...known.values()]
			.sort(
				(a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || a.name.localeCompare(b.name)
			)
			.map((map) => ({ value: map.ref, label: map.name }))
	);

	const sourceLabel = (source: TournamentMap['source']) =>
		source === 'workshop' ? t('Workshop') : t('Custom');

	function remove(ref: string) {
		value = value.filter((item) => item !== ref);
	}

	function openCreate() {
		newName = '';
		newIcon = null;
		newIconClear = false;
		createOpen = true;
	}

	async function create() {
		if (creating || !newName.trim()) {
			return;
		}

		creating = true;
		try {
			const map = await host.api.tournaments.createMap(newName.trim(), newIcon);
			added = [...added, map];
			value = [...value, map.ref];
			createOpen = false;
			host.notify.success(t('Map added.'));
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Could not add the map.'));
		} finally {
			creating = false;
		}
	}
</script>

<div class="flex w-full flex-col gap-3">
	{#if selected.length}
		<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each selected as map (map.ref)}
				<li
					class="border-secondary-800 bg-secondary-950/60 flex items-center gap-3 rounded-md border p-2"
				>
					<TournamentMapThumb {map} class="w-12 shrink-0" />
					<span class="min-w-0 flex-1 truncate text-sm text-white">{map.name}</span>
					{#if map.source !== 'stock'}
						<Badge variant="default">{sourceLabel(map.source)}</Badge>
					{/if}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t('Remove {name}', { name: map.name })}
						{disabled}
						onclick={() => remove(map.ref)}
					>
						<CloseIcon size={14} />
					</Button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-secondary-400 text-sm">{t('No maps in the pool yet.')}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<Button
			type="button"
			variant="secondary"
			size="sm"
			{disabled}
			onclick={() => (pickerOpen = true)}
		>
			<PlusIcon size={14} />
			{t('Add maps')}
		</Button>
		{#if host.auth.user?.isStaff}
			<Button type="button" variant="ghost" size="sm" {disabled} onclick={openCreate}>
				{t('New custom map')}
			</Button>
		{/if}
	</div>

	<Selection
		{options}
		multiple
		hideTrigger
		bind:open={pickerOpen}
		{value}
		onValueChange={(next) => (value = Array.isArray(next) ? next : [next])}
		searchPlaceholder={t('Search maps...')}
		noResultsLabel={t('No maps found.')}
	>
		{#snippet renderOption({ option })}
			{@const map = known.get(option.value)}
			<span class="flex min-w-0 items-center gap-3">
				{#if map}
					<TournamentMapThumb {map} class="w-9 shrink-0" />
				{/if}
				<span class="truncate">{option.label}</span>
				{#if map && map.source !== 'stock'}
					<Badge variant="default">{sourceLabel(map.source)}</Badge>
				{/if}
			</span>
		{/snippet}
	</Selection>
</div>

<Dialog.Root
	open={createOpen}
	onOpenChange={(next) => {
		if (!creating) {
			createOpen = next;
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 w-[440px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{t('New custom map')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{t(
								'For a map that is not in the list, like a community map. It can be used in every tournament.'
							)}
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
			<form
				class="flex flex-col gap-4 p-4"
				onsubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void create();
				}}
			>
				<div class="flex flex-col gap-2">
					<Label for="tournament-map-name">{t('Name')}</Label>
					<Input id="tournament-map-name" bind:value={newName} maxlength={80} required />
				</div>
				<div class="flex flex-col gap-2">
					<span class="text-secondary-300 text-sm font-medium">{t('Map icon')}</span>
					<TournamentImageField
						id="tournament-map-icon"
						shape="square"
						currentUrl={null}
						maxBytes={TOURNAMENT_MAP_ICON_MAX_BYTES}
						tooBigMessage="The map icon must be 2 MB or smaller."
						bind:file={newIcon}
						bind:clear={newIconClear}
						disabled={creating}
					/>
				</div>
				<div class="flex justify-end gap-2">
					<Button
						type="button"
						variant="secondary"
						disabled={creating}
						onclick={() => (createOpen = false)}
					>
						{t('Cancel')}
					</Button>
					<Button type="submit" loading={creating} disabled={creating || !newName.trim()}>
						{t('Add map')}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
