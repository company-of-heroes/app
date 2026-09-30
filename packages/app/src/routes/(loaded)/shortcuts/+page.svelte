<script lang="ts">
	import Sortable from 'sortablejs';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import ExportIcon from 'phosphor-svelte/lib/ExportIcon';
	import ImportIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import KeyboardIcon from 'phosphor-svelte/lib/KeyboardIcon';
	import { onDestroy } from 'svelte';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { shortcuts, type BindingScope } from '$core/app/features/shortcuts';
	import { Button } from '$lib/components/ui/button';
	import { KeybindingRow } from '$lib/components/shortcuts';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const scopes: { label: string; value: BindingScope }[] = [
		{ label: t('Global'), value: 'global' },
		{ label: 'USA', value: 'allies' },
		{ label: 'Brits', value: 'allies_commonwealth' },
		{ label: 'Werhmacht', value: 'axis' },
		{ label: 'Panzer Elite', value: 'axis_panzer_elite' }
	];

	let scope = $state<BindingScope>('allies');
	let keybindings = $derived(shortcuts.getBindings(scope));
	let isGlobal = $derived(scope === 'global');
	let sortableEl = $state<HTMLTableSectionElement | null>(null);
	let sortableInstance: Sortable | undefined;

	function destroySortable() {
		if (!sortableInstance) {
			return;
		}

		try {
			sortableInstance.destroy();
		} catch {
			// Sortable's element was already removed from the document.
		}

		sortableInstance = undefined;
	}

	$effect(() => {
		scope;
		sortableEl;
		const count = keybindings.length;

		if (!sortableEl || count === 0) {
			return destroySortable;
		}

		sortableInstance = Sortable.create(sortableEl, {
			handle: '.handle',
			draggable: '.item',
			animation: 150,
			onEnd: (event) => {
				if (event.oldIndex == null || event.newIndex == null || event.oldIndex === event.newIndex) {
					return;
				}

				shortcuts.moveBinding(scope, event.oldIndex, event.newIndex);
			}
		});

		return destroySortable;
	});

	onDestroy(() => {
		destroySortable();
		shortcuts.stopAllRecording();
	});
</script>

<div
	class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b p-4"
>
	<ToggleGroup bind:value={scope} items={scopes} class="w-fit" />
	<div class="flex flex-wrap gap-1">
		<Button variant="secondary" onclick={() => shortcuts.importSettings()}>
			<ImportIcon />
			{t('Import')}
		</Button>
		<Button variant="secondary" onclick={() => shortcuts.exportSettings()}>
			<ExportIcon />
			{t('Export')}
		</Button>
	</div>
</div>

<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
	{t(
		'Use Global for hotkeys that apply in every match. Faction tabs add extra bindings for that army and override the same key. Hotkeys only work during an active match while Company of Heroes is focused (not in chat). Click a chord field to record keys.'
	)}
</p>

<table class="w-full table-fixed">
	<colgroup>
		<col class="w-10" />
		<col class="w-[22%]" />
		<col />
		<col class="w-10" />
		<col />
		<col class="w-10" />
	</colgroup>
	{#if keybindings.length > 0}
		<thead>
			<tr
				class="bg-secondary-950/90 text-secondary-300 border-secondary-800 border-b text-left text-xs font-semibold tracking-wide uppercase"
			>
				<th class="px-2 py-3" aria-hidden="true"></th>
				<th class="px-4 py-3">{t('Name')}</th>
				<th class="px-4 py-3">{t('When you press')}</th>
				<th class="px-2 py-3" aria-hidden="true"></th>
				<th class="px-4 py-3">{t('Game receives')}</th>
				<th class="px-2 py-3" aria-hidden="true"></th>
			</tr>
		</thead>
	{/if}
	<tbody bind:this={sortableEl}>
		{#if keybindings.length === 0}
			<tr>
				<td colspan="6" class="px-4 py-10">
					<div class="flex flex-col items-center gap-3 text-center">
						<KeyboardIcon class="text-secondary-600 size-10" weight="duotone" />
						<div>
							<p class="text-secondary-300 font-medium">
								{isGlobal ? t('No global keybindings') : t('No keybindings for this faction')}
							</p>
							<p class="text-secondary-500 mt-1 text-sm">
								{isGlobal
									? t('These apply in every match, on top of the faction you pick.')
									: t(
											'Add a binding below, then record what you press and what the game should receive.'
										)}
							</p>
						</div>
					</div>
				</td>
			</tr>
		{:else}
			{#each keybindings as keybinding (keybinding.id)}
				<KeybindingRow {keybinding} {scope} />
			{/each}
		{/if}
	</tbody>
</table>

<div class="border-secondary-800 border-t p-4">
	<Button variant="secondary" class="w-fit" onclick={() => shortcuts.addBinding(scope)}>
		<PlusIcon />
		{t('Add keybinding')}
	</Button>
</div>
