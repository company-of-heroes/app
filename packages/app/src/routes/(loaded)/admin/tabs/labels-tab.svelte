<script lang="ts">
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import PlayerLabels from '$lib/components/player/player-labels.svelte';
	import PlayerLabelEditor from '$lib/components/player/player-label-editor.svelte';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import {
		DEFAULT_LABEL_HEX,
		labelColorSwatches,
		labelHex,
		labelsBySteamId,
		listAssignmentsForSteamIds,
		listUserLabels,
		type UserLabel
	} from '$core/pocketbase/user-labels';
	import { setLabelsForSteamId } from '$core/pocketbase/player-label-cache.svelte';
	import type { Create, Update } from '$core/pocketbase/types';
	import { relic } from '$lib/relic';
	import { steam } from '$core/steam';
	import { cn, isProfileId, isSteamId } from '$lib/utils';
	import {
		adornedControl,
		adornedInput,
		adornedLeading,
		footerAction
	} from '$lib/components/ui/variants';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { mergeSteamProfiles, PlayersSearch } from '../../players/players-search.svelte';
	import ColorPicker from 'svelte-awesome-color-picker';
	import ColorPickerTrigger from '$lib/components/ui/input/color-picker-trigger.svelte';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';

	const { t } = useI18n();

	let name = $state('');
	let hex = $state<string | null>(DEFAULT_LABEL_HEX);
	let editingSort = $state(0);
	let labels = $state.raw<UserLabel[]>([]);
	let isSaving = $state(false);
	let deletingId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let nameField: HTMLInputElement | undefined;
	const previewName = $derived(name.trim());
	const canSave = $derived(previewName.length > 0 && !isSaving);

	let playerSearch = $state(new PlayersSearch());
	let searchingPlayers = $state(false);
	let searchedPlayers = $state(false);
	const canSearchPlayers = $derived(playerSearch.query.trim().length > 0 && !searchingPlayers);

	function bindNameField(el: HTMLInputElement) {
		nameField = el;
		return () => {
			if (nameField === el) {
				nameField = undefined;
			}
		};
	}

	watch(
		() => app.account.isAdmin,
		(isAdmin) => {
			if (isAdmin) {
				void loadLabels();
			}
		}
	);

	function resetForm() {
		name = '';
		hex = DEFAULT_LABEL_HEX;
		editingSort = 0;
		editingId = null;
	}

	function nextSort() {
		return labels.reduce((max, label) => Math.max(max, label.sort ?? 0), -1) + 1;
	}

	async function loadLabels() {
		try {
			labels = await listUserLabels();
		} catch (error) {
			console.error('[ADMIN]: user labels load failed:', error);
			app.toast.error(t('Could not load labels.'));
		}
	}

	const startEdit = (label: UserLabel) => {
		editingId = label.id;
		name = label.name;
		hex = labelHex(label.color);
		editingSort = label.sort ?? 0;
		nameField?.focus();
	};

	const saveLabel = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}

		isSaving = true;
		try {
			if (editingId) {
				const data: Update<'user_labels'> = {
					name: trimmed,
					color: labelHex(hex),
					sort: editingSort
				};
				await pocketbase.collection('user_labels').update(editingId, data, { fetch });
				app.toast.success(t('Label updated.'));
			} else {
				const data: Create<'user_labels'> = {
					name: trimmed,
					color: labelHex(hex),
					sort: nextSort()
				};
				await pocketbase.collection('user_labels').create(data, { fetch });
				app.toast.success(t('Label created.'));
			}

			resetForm();
			await loadLabels();
		} catch (error) {
			console.error('[ADMIN]: user label save failed:', error);
			app.toast.error(t('Could not save label.'));
		} finally {
			isSaving = false;
		}
	};

	const removeLabel = async (label: UserLabel) => {
		const confirmed = await confirm(
			t('Delete {name}? This removes it from every assigned player.', { name: label.name }),
			{ okLabel: t('Delete'), cancelLabel: t('Cancel'), kind: 'warning' }
		);
		if (!confirmed) {
			return;
		}

		deletingId = label.id;
		try {
			await pocketbase.collection('user_labels').delete(label.id, { fetch });
			if (editingId === label.id) {
				resetForm();
			}

			app.toast.success(t('Label deleted.'));
			await loadLabels();
			if (searchedPlayers) {
				await loadAssignments(playerSearch.results.map((player) => player.steam.steamid));
			}
		} catch (error) {
			console.error('[ADMIN]: user label delete failed:', error);
			app.toast.error(t('Could not delete label.'));
		} finally {
			deletingId = null;
		}
	};

	const loadAssignments = async (steamIds: string[]) => {
		try {
			const rows = await listAssignmentsForSteamIds(steamIds);
			const bySteam = labelsBySteamId(rows);
			for (const steamId of steamIds) {
				setLabelsForSteamId(steamId, bySteam[steamId] ?? []);
			}
		} catch (error) {
			console.error('[ADMIN]: player label assignments failed:', error);
			app.toast.error(t('Could not load player labels.'));
		}
	};

	const searchPlayers = async () => {
		const trimmed = playerSearch.query.trim();
		if (!trimmed) {
			return;
		}

		searchingPlayers = true;
		playerSearch.error = null;
		playerSearch.resetResults();
		try {
			if (isSteamId(trimmed) || isProfileId(trimmed)) {
				const profile = await relic.resolveProfile(trimmed);
				if (!profile) {
					playerSearch.error = t('Player not found');
					searchedPlayers = true;
					return;
				}

				const steamId = profile.name.replace('/steam/', '');
				const steamProfiles = await steam.getUserProfiles([steamId]);
				playerSearch.results = mergeSteamProfiles([profile], steamProfiles);
			} else {
				const players = await relic.searchProfilesByName(trimmed);
				if (players.length === 0) {
					playerSearch.error = t('Player not found');
					searchedPlayers = true;
					return;
				}

				const steamIds = players.map((profile) => profile.name.replace('/steam/', ''));
				const steamProfiles = await steam.getUserProfiles(steamIds);
				playerSearch.results = mergeSteamProfiles(players, steamProfiles);
			}

			if (playerSearch.results.length === 0) {
				playerSearch.error = t('Player not found');
			} else {
				await loadAssignments(playerSearch.results.map((player) => player.steam.steamid));
			}

			searchedPlayers = true;
		} catch {
			playerSearch.error = t('Failed to search for player');
			searchedPlayers = true;
		} finally {
			searchingPlayers = false;
		}
	};
</script>

<Form.Group
	inputId="new-label-name"
	label={t('New label')}
	description={t('Shown next to Relic player names. Search a player below to assign them.')}
>
	<div class={cn(adornedControl, 'min-w-0 flex-1')}>
		<span class={cn(adornedLeading, 'max-w-36')}>
			<Badge hex={labelHex(hex)} class="max-w-full">
				<span class="truncate">{previewName || t('Label')}</span>
			</Badge>
		</span>
		<input
			id="new-label-name"
			{@attach bindNameField}
			bind:value={name}
			class={adornedInput}
			placeholder={t('Premium')}
			maxlength={40}
			aria-label={t('Label name')}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void saveLabel();
				}

				if (event.key === 'Escape' && editingId) {
					event.preventDefault();
					resetForm();
				}
			}}
		/>
	</div>
	<div class="label-color-picker relative z-20 shrink-0">
		<ColorPicker
			bind:hex
			label={t('Color')}
			isAlpha={false}
			position="responsive"
			textInputModes={['hex']}
			swatches={labelColorSwatches}
			components={{ input: ColorPickerTrigger }}
		/>
	</div>
	<Button
		type="button"
		variant="secondary"
		class="w-fit shrink-0"
		disabled={!canSave}
		loading={isSaving}
		onclick={() => saveLabel()}
	>
		<PlusIcon size={16} />
		{editingId ? t('Save label') : t('Add label')}
	</Button>
	{#if editingId}
		<Button type="button" variant="secondary" class="w-fit shrink-0" onclick={resetForm}>
			<XIcon size={16} />
			{t('Cancel')}
		</Button>
	{/if}
</Form.Group>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">{t('Labels')}</p>
	</div>
	{#if labels.length === 0}
		<p class="text-secondary-400 px-4 py-6 text-sm">{t('No labels yet.')}</p>
	{:else}
		<ul class="divide-secondary-800 border-secondary-800 divide-y border-b">
			{#each labels as label (label.id)}
				<li class={cn('flex min-h-11 items-stretch', editingId === label.id && 'bg-primary/10')}>
					<div class="flex min-w-0 flex-1 items-center px-4">
						<Badge hex={labelHex(label.color)}>{label.name}</Badge>
					</div>
					<div class="border-secondary-800 flex items-stretch border-l">
						<Button
							type="button"
							variant="ghost"
							class={cn(footerAction, 'text-secondary-400 hover:text-white')}
							onclick={() => startEdit(label)}
							aria-label={t('Edit')}
						>
							<PencilSimpleIcon size={16} />
							{t('Edit')}
						</Button>
						<Button
							type="button"
							variant="ghost"
							class={cn(footerAction, 'text-secondary-400 hover:text-white', 'border-r-0')}
							loading={deletingId === label.id}
							onclick={() => removeLabel(label)}
							aria-label={t('Delete')}
						>
							<TrashIcon size={16} />
							{t('Delete')}
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<Form.Group
	inputId="label-player-search"
	label={t('Assign labels')}
	description={t('Search for a player by Steam ID, profile ID, or in-game name.')}
>
	<Input
		id="label-player-search"
		bind:value={playerSearch.query}
		placeholder={t('Steam ID, profile ID, or player name')}
		aria-label={t('Search players')}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void searchPlayers();
			}
		}}
	/>
	<Button
		type="button"
		variant="secondary"
		class="w-fit shrink-0"
		disabled={!canSearchPlayers}
		loading={searchingPlayers}
		onclick={() => searchPlayers()}
	>
		<MagnifyingGlassIcon size={16} />
		{t('Search')}
	</Button>
</Form.Group>

{#if playerSearch.error}
	<p class="text-destructive px-4 py-3 text-sm">{playerSearch.error}</p>
{/if}

{#if searchedPlayers && !playerSearch.error}
	<section>
		<div class="border-secondary-800 border-b px-4 py-3">
			<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">{t('Players')}</p>
		</div>
		{#if playerSearch.results.length === 0}
			<p class="text-secondary-400 px-4 py-6 text-sm">{t('Player not found')}</p>
		{:else}
			<ul class="divide-secondary-800 divide-y">
				{#each playerSearch.results as player (player.relic.profile_id)}
					<li class="flex min-h-11 items-stretch">
						<div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-2">
							<span class="flex min-w-0 flex-wrap items-center gap-2">
								<span class="truncate font-medium">{player.relic.alias}</span>
								<PlayerLabels steamId={player.steam.steamid} class="shrink-0" />
							</span>
							<span class="text-secondary-400 text-xs">{player.steam.steamid}</span>
						</div>
						<div class="border-secondary-800 flex items-stretch border-l">
							<PlayerLabelEditor
								steamId={player.steam.steamid}
								profileId={player.relic.profile_id}
								alias={player.relic.alias}
								class={cn(
									footerAction,
									'text-secondary-400 h-auto min-h-11 rounded-none px-3 hover:text-white',
									'border-r-0'
								)}
							/>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.label-color-picker {
		--picker-height: 160px;
		--picker-width: 180px;
		--input-size: 2.75rem;
		--picker-z-index: 200;
		--focus-color: var(--color-primary);
		--cp-bg-color: var(--color-secondary-900);
		--cp-border-color: var(--color-secondary-700);
		--cp-text-color: var(--color-secondary-200);
		--cp-input-color: var(--color-secondary-800);
		--cp-button-hover-color: var(--color-secondary-700);
	}
</style>
