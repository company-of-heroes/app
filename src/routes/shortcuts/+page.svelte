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
	import { createRawSnippet, onDestroy, onMount } from 'svelte';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { shortcuts, type Shortcut, type ShortcutSettings } from '$core/app/features/shortcuts';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Kbd } from '$lib/components/ui/kbd';
	import { tooltip } from '$lib/attachments';
	import Alert from '$lib/components/ui/alert/alert.svelte';

	let faction = $state<keyof ShortcutSettings['factions']>('allies');
	let factions = [
		{
			label: 'USA',
			value: 'allies'
		},
		{
			label: 'Brits',
			value: 'allies_commonwealth'
		},
		{
			label: 'Werhmacht',
			value: 'axis'
		},
		{
			label: 'Panzer Elite',
			value: 'axis_panzer_elite'
		}
	];
	let keybindings = $derived(shortcuts.settings.factions[faction]);
	let sortableEl = $state<HTMLDivElement | null>(null);

	onMount(() => {
		if (!sortableEl) {
			return;
		}

		Sortable.create(sortableEl, {
			handle: '.handle',
			draggable: '.item',
			animation: 150,
			onSort: (event) => {
				const [movedItem] = keybindings.splice(event.oldIndex!, 1);
				keybindings.splice(event.newIndex!, 0, movedItem);
				console.log(keybindings);
			}
		});
	});

	onDestroy(() => {
		for (const [keybinding, entry] of shortcuts.handlers) {
			if (entry.trigger) {
				document.removeEventListener('keydown', entry.trigger.handler);
				clearTimeout(entry.trigger.timeout);
				keybinding.isRecordingTriggerKeys = false;
			}
			if (entry.action) {
				document.removeEventListener('keydown', entry.action.handler);
				clearTimeout(entry.action.timeout);
				keybinding.isRecordingActionKeys = false;
			}
		}
		shortcuts.handlers.clear();
	});
</script>

{#snippet triggerButton(type: 'trigger' | 'action', keybinding: Shortcut)}
	<Button
		class="hidden p-2.5 group-hover:block"
		onclick={() => shortcuts.record(keybinding, type)}
		{@attach tooltip(type === 'trigger' ? 'Record Trigger Keys' : 'Record Action Keys')}
	>
		{#if type === 'trigger' ? keybinding.isRecordingTriggerKeys : keybinding.isRecordingActionKeys}
			<StopIcon weight="fill" class="text-destructive" />
		{:else}
			<RecordIcon weight="fill" class="text-primary" />
		{/if}
	</Button>
{/snippet}

<div class="mb-8 flex items-center justify-between">
	<H level="1">Keybindings</H>
	<div class="flex">
		<Button variant="ghost" onclick={() => shortcuts.importSettings()}>
			<ImportIcon />
			Import keybindings
		</Button>
		<Button variant="ghost" onclick={() => shortcuts.exportSettings()}>
			<ExportIcon />
			Export keybindings
		</Button>
	</div>
</div>
<Form.Root class="justify-start">
	<div class="flex gap-4">
		<ToggleGroup bind:value={faction} items={factions} />
	</div>
	<div bind:this={sortableEl} class="grid grid-cols-1">
		{#if keybindings?.length === 0}
			<Alert variant="info">No keybindings configured yet, add one using the button below.</Alert>
		{/if}
		{#each keybindings as keybinding, index (keybinding)}
			<div
				class={cn(
					'group item flex flex-row items-center gap-4 border border-transparent px-4 py-2',
					'[&.sortable-ghost]:bg-primary/5 [&.sortable-chosen]:cursor-grabbing',
					'not-last:border-b-secondary-950/70 not-last:border-b'
				)}
			>
				<!-- Drag Handle -->
				<button class="handle cursor-grab text-gray-500 transition-colors hover:text-white">
					<HandleIcon size={32} weight="bold" />
				</button>

				<!-- Description -->
				<Input
					bind:value={keybinding.description}
					placeholder="Description"
					class="truncate border-none bg-transparent font-medium text-gray-200 focus:text-white"
				/>

				<!-- Trigger Keys -->
				<span class="flex items-center gap-2">
					{@render triggerButton('trigger', keybinding)}
					{#each keybinding.triggerKeys as triggerKey, index}
						{#if index > 0}
							<PlusIcon class="text-secondary-300" />
						{/if}
						<Kbd>{triggerKey}</Kbd>
					{/each}
				</span>

				<ArrowRightIcon class="text-secondary-600" />

				<!-- Action Keys -->
				<span class="flex items-center gap-2">
					{@render triggerButton('action', keybinding)}
					{#each keybinding.actionKeys as actionKey, index}
						{#if index > 0}
							<PlusIcon class="text-secondary-300" />
						{/if}
						<Kbd>{actionKey}</Kbd>
					{/each}
				</span>

				<Button
					variant="ghost"
					onclick={() => {
						keybindings.splice(index, 1);
					}}
					class="hover:text-destructive p-2.5 text-gray-400"
					{@attach tooltip('Delete')}
				>
					<TrashIcon />
				</Button>
			</div>
		{/each}
	</div>
	<Form.Group>
		<Button
			variant="secondary"
			class="w-fit"
			onclick={() => {
				shortcuts.settings.factions[faction].push({
					description: 'New Keybinding',
					triggerKeys: [],
					actionKeys: []
				});
			}}
		>
			<PlusIcon />
			Add keybinding
		</Button>
	</Form.Group>
</Form.Root>
