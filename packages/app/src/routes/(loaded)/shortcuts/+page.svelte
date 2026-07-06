<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import Sortable from 'sortablejs';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import RecordIcon from 'phosphor-svelte/lib/Record';
	import StopIcon from 'phosphor-svelte/lib/Stop';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';
	import HandleIcon from 'phosphor-svelte/lib/DotsSixVertical';
	import ExportIcon from 'phosphor-svelte/lib/Export';
	import ImportIcon from 'phosphor-svelte/lib/DownloadSimple';
	import { H } from '$lib/components/ui/h';
	import { onDestroy } from 'svelte';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { cn } from '$lib/utils';
	import { shortcuts, type Shortcut, type FactionKey } from '$core/app/features/shortcuts';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Kbd } from '$lib/components/ui/kbd';
	import { tooltip } from '$lib/attachments';
	import Alert from '$lib/components/ui/alert/alert.svelte';

	const factions: { label: string; value: FactionKey }[] = [
		{ label: 'USA', value: 'allies' },
		{ label: 'Brits', value: 'allies_commonwealth' },
		{ label: 'Werhmacht', value: 'axis' },
		{ label: 'Panzer Elite', value: 'axis_panzer_elite' }
	];

	let faction = $state<FactionKey>('allies');
	let keybindings = $derived(shortcuts.getBindings(faction));
	let sortableEl = $state<HTMLDivElement | null>(null);
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
		faction;
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

				shortcuts.moveBinding(faction, event.oldIndex, event.newIndex);
			}
		});

		return destroySortable;
	});

	onDestroy(() => {
		destroySortable();
		shortcuts.stopAllRecording();
	});

	function isRecording(keybinding: Shortcut, type: 'trigger' | 'action') {
		return type === 'trigger'
			? Boolean(keybinding.isRecordingTriggerKeys)
			: Boolean(keybinding.isRecordingActionKeys);
	}
</script>

{#snippet keyColumn(type: 'trigger' | 'action', keybinding: Shortcut)}
	{@const recording = isRecording(keybinding, type)}
	{@const keys = type === 'trigger' ? keybinding.triggerKeys : keybinding.actionKeys}
	<div
		class={cn(
			'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-transparent px-2 py-1',
			recording && 'border-destructive/40 bg-destructive/5'
		)}
	>
		<Button
			variant={recording ? 'destructive' : 'secondary'}
			size="sm"
			class="shrink-0"
			onclick={() => shortcuts.record(keybinding, type)}
			{@attach tooltip(
				recording
					? 'Stop recording'
					: type === 'trigger'
						? 'Record trigger keys'
						: 'Record action keys'
			)}
		>
			{#if recording}
				<StopIcon weight="fill" />
			{:else}
				<RecordIcon weight="fill" />
			{/if}
		</Button>
		<div class="flex min-w-0 flex-wrap items-center gap-1.5">
			{#if keys.length === 0}
				<span class="text-secondary-500 text-sm italic">
					{recording ? 'Press keys…' : 'Not set'}
				</span>
			{:else}
				{#each keys as key, keyIndex (key)}
					{#if keyIndex > 0}
						<PlusIcon class="text-secondary-400 size-3 shrink-0" />
					{/if}
					<Kbd>{key}</Kbd>
				{/each}
			{/if}
		</div>
	</div>
{/snippet}

<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
	<div>
		<H level="1">Keybindings</H>
		<p class="text-secondary-400 mt-1 text-sm">
			Configure hotkeys per faction. They only work during an active match while Company of Heroes
			is focused (not in chat). Use the faction tab that matches your army.
		</p>
	</div>
	<div class="flex flex-wrap gap-1">
		<Button variant="ghost" onclick={() => shortcuts.importSettings()}>
			<ImportIcon />
			Import
		</Button>
		<Button variant="ghost" onclick={() => shortcuts.exportSettings()}>
			<ExportIcon />
			Export
		</Button>
	</div>
</div>

<Form.Root class="justify-start gap-6">
	<ToggleGroup bind:value={faction} items={factions} class="w-fit" />

	<section class="border-secondary-800 overflow-hidden rounded-lg border">
		{#if keybindings.length > 0}
			<div
				class="text-secondary-500 border-secondary-800 bg-secondary-950/40 hidden grid-cols-[2rem_minmax(8rem,1fr)_1fr_auto_1fr_2.5rem] items-center gap-3 border-b px-3 py-2 text-xs font-medium tracking-wide uppercase sm:grid"
			>
				<span aria-hidden="true"></span>
				<span>Description</span>
				<span>Trigger</span>
				<span aria-hidden="true"></span>
				<span>Action</span>
				<span aria-hidden="true"></span>
			</div>
		{/if}

		<div bind:this={sortableEl} class="divide-secondary-800/70 divide-y">
			{#if keybindings.length === 0}
				<div class="p-6">
					<Alert variant="info">
						No keybindings for this faction yet. Add one below, then record trigger and action keys.
					</Alert>
				</div>
			{:else}
				{#each keybindings as keybinding (keybinding.id)}
					<div
						class={cn(
							'item group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[2rem_minmax(8rem,1fr)_1fr_auto_1fr_2.5rem]',
							'[&.sortable-ghost]:bg-primary/5 [&.sortable-chosen]:cursor-grabbing'
						)}
					>
						<button
							type="button"
							class="handle text-secondary-500 hover:text-secondary-200 flex cursor-grab justify-center transition-colors"
							aria-label="Reorder keybinding"
						>
							<HandleIcon size={24} weight="bold" />
						</button>

						<Input
							bind:value={keybinding.description}
							placeholder="Description"
							class="border-none bg-transparent font-medium focus:text-white"
						/>

						<div class="col-span-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:contents">
							{@render keyColumn('trigger', keybinding)}
							<ArrowRightIcon
								class="text-secondary-600 mx-auto hidden size-4 shrink-0 sm:block"
								aria-hidden="true"
							/>
							{@render keyColumn('action', keybinding)}
						</div>

						<Button
							variant="ghost"
							size="sm"
							class="hover:text-destructive text-secondary-500 justify-self-end"
							onclick={() => shortcuts.removeBinding(faction, keybinding.id)}
							{@attach tooltip('Delete keybinding')}
						>
							<TrashIcon />
						</Button>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<Form.Group>
		<Button variant="secondary" class="w-fit" onclick={() => shortcuts.addBinding(faction)}>
			<PlusIcon />
			Add keybinding
		</Button>
	</Form.Group>
</Form.Root>
