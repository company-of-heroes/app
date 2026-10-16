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
	import {
		TOURNAMENT_MEDAL_MAX_BYTES,
		TOURNAMENT_MEDAL_TYPES,
		type TournamentCustomMedal
	} from '@company-of-heroes/api/tournaments';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { ImageField } from '../ui/image-field';
	import { Input } from '../ui/input';
	import { Label } from '../ui/label';
	import { ToggleGroup } from '../ui/toggle-group';
	import { MEDAL_METALS } from './medal';

	type Props = {
		/** Medal key (`medal-042`, or `custom:<id>` for an uploaded one), or null for the default. */
		value: string | null;
		/** The tournament's uploaded medal, so it shows before the list has loaded. */
		initial?: TournamentCustomMedal | null;
		/** The tournament being edited: its own medal is not "already used". */
		tournamentId?: string;
		disabled?: boolean;
	};

	let { value = $bindable(), initial = null, tournamentId, disabled = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	type Choice = { key: string; url: string; title: string };

	const builtIns = host.resolve.medals();
	const METAL_LABELS = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

	let open = $state(false);
	let metal = $state('all');
	/** Medals other tournaments already use. */
	let used = $state.raw(new Set<string>());
	/** Uploaded medals; null until the picker loaded them. */
	let uploaded = $state.raw<Choice[] | null>(null);
	let createOpen = $state(false);
	let newName = $state('');
	let newImage = $state<File | null>(null);
	let newImageClear = $state(false);
	let creating = $state(false);

	const toChoice = (medal: TournamentCustomMedal): Choice => ({
		key: medal.ref,
		url: medal.imageUrl,
		title: medal.name
	});

	const customs = $derived(uploaded ?? (initial ? [toChoice(initial)] : []));
	const selected = $derived<Choice | null>(
		[...builtIns, ...customs].find((medal) => medal.key === value) ?? null
	);
	const visible = $derived<Choice[]>(
		metal === 'all'
			? [...customs, ...builtIns]
			: metal === 'custom'
				? customs
				: builtIns.filter((medal) => medal.metal === metal)
	);
	const metalItems = $derived([
		{ value: 'all', label: t('All') },
		{ value: 'custom', label: t('Custom') },
		...MEDAL_METALS.map((value) => ({ value, label: t(METAL_LABELS[value]) }))
	]);

	async function openPicker() {
		open = true;
		const [uses, medals] = await Promise.allSettled([
			host.api.tournaments.usedMedals(),
			host.api.tournaments.listMedals()
		]);
		used =
			uses.status === 'fulfilled'
				? new Set(
						uses.value.filter((use) => use.tournamentId !== tournamentId).map((use) => use.medal)
					)
				: new Set();
		if (medals.status === 'fulfilled') {
			uploaded = medals.value.map(toChoice);
		}
	}

	function choose(key: string) {
		value = key;
		open = false;
	}

	function openCreate() {
		newName = '';
		newImage = null;
		newImageClear = false;
		createOpen = true;
	}

	async function create() {
		if (creating || !newName.trim() || !newImage) {
			return;
		}

		creating = true;
		try {
			const medal = await host.api.tournaments.createMedal(newName.trim(), newImage);
			uploaded = [toChoice(medal), ...customs.filter((entry) => entry.key !== medal.ref)];
			createOpen = false;
			host.notify.success(t('Medal uploaded.'));
			choose(medal.ref);
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Could not upload the medal.'));
		} finally {
			creating = false;
		}
	}
</script>

<div class="flex items-start gap-4">
	<div
		class="border-secondary-800 bg-secondary-950 flex h-28 w-20 shrink-0 items-center justify-center rounded-md border"
	>
		{#if selected}
			<img src={selected.url} alt={selected.title} class="h-24 max-w-18 object-contain" />
		{:else}
			<span class="text-secondary-500 px-2 text-center text-xs">{t('Default medal')}</span>
		{/if}
	</div>
	<div class="flex flex-col items-start gap-2">
		<div class="flex flex-wrap gap-2">
			<Button type="button" variant="secondary" size="sm" {disabled} onclick={openPicker}>
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
				{#if metal === 'all' || metal === 'custom'}
					<li>
						<button
							type="button"
							title={t('Upload medal')}
							onclick={openCreate}
							class={cn(
								interactive,
								'border-secondary-700 text-secondary-400 hover:bg-secondary-800/60 hover:text-secondary-200 flex h-full min-h-28 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-1 py-2 transition-colors'
							)}
						>
							<UploadSimpleIcon size={20} />
							<span class="text-center text-xs">{t('Upload medal')}</span>
						</button>
					</li>
				{/if}
				{#each visible as medal (medal.key)}
					{@const taken = used.has(medal.key) && medal.key !== value}
					<li>
						<button
							type="button"
							title={taken ? `${medal.title} (${t('Already used')})` : medal.title}
							aria-label={medal.title}
							aria-pressed={medal.key === value}
							disabled={taken}
							onclick={() => choose(medal.key)}
							class={cn(
								interactive,
								'flex w-full flex-col items-center gap-1 rounded-md border py-2 transition-colors',
								taken ? '' : 'hover:bg-secondary-800/60',
								medal.key === value ? 'border-warning bg-warning/10' : 'border-transparent'
							)}
						>
							<img
								src={medal.url}
								alt=""
								loading="lazy"
								class={cn('h-24 w-auto max-w-full object-contain', taken && 'opacity-30 grayscale')}
							/>
							{#if taken}
								<span class="text-secondary-500 text-xs">{t('Already used')}</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

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
						<p class={flushHeaderTitle}>{t('Upload medal')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{t('A PNG or SVG of at most 1 MB. Every tournament can use it.')}
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
					<Label for="tournament-medal-name">{t('Name')}</Label>
					<Input id="tournament-medal-name" bind:value={newName} maxlength={80} required />
				</div>
				<div class="flex flex-col gap-2">
					<span class="text-secondary-300 text-sm font-medium">{t('Medal image')}</span>
					<ImageField
						id="tournament-medal-image"
						shape="portrait"
						currentUrl={null}
						accept={TOURNAMENT_MEDAL_TYPES}
						typeMessage="Use a PNG or SVG image."
						maxBytes={TOURNAMENT_MEDAL_MAX_BYTES}
						tooBigMessage="The medal must be 1 MB or smaller."
						bind:file={newImage}
						bind:clear={newImageClear}
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
					<Button
						type="submit"
						loading={creating}
						disabled={creating || !newName.trim() || !newImage}
					>
						{t('Upload medal')}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
