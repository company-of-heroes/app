<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { tooltip } from '$lib/attachments';
	import { shortcuts, type Shortcut } from '$core/app/features/shortcuts';
	import { Button } from '$lib/components/ui/button';
	import KeyCap from './key-cap.svelte';
	import { formatKeyLabel } from './key-label';
	import { useI18n } from '$lib/i18n';

	type Props = {
		keybinding: Shortcut;
		type: 'trigger' | 'action';
		class?: string;
	};

	let { keybinding, type, class: className }: Props = $props();
	const { t } = useI18n();

	const recording = $derived(shortcuts.isRecording(keybinding, type));
	const keys = $derived(type === 'trigger' ? keybinding.triggerKeys : keybinding.actionKeys);
</script>

<div
	class={cn(
		'flex min-h-9 w-full min-w-0 items-center gap-2',
		recording && 'border-destructive/40 bg-destructive/5 rounded-md border px-2 py-1.5',
		className
	)}
>
	{#if recording}
		<div class="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto">
			{#if keys.length === 0}
				<span class="text-destructive text-sm italic">{t('Press keys…')}</span>
			{:else}
				{#each keys as key, keyIndex (key)}
					{#if keyIndex > 0}
						<PlusIcon class="text-secondary-500 size-3 shrink-0" weight="bold" />
					{/if}
					<KeyCap>{formatKeyLabel(key)}</KeyCap>
				{/each}
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-1">
			<Button
				type="button"
				variant="secondary"
				size="icon-sm"
				class={interactive}
				onclick={() => shortcuts.commitRecording(keybinding, type)}
				{@attach tooltip(t('Save keys (Enter)'))}
			>
				<CheckIcon weight="bold" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={cn(interactive, 'hover:text-destructive')}
				onclick={() => shortcuts.cancelRecording(keybinding, type)}
				{@attach tooltip(t('Cancel and restore (Esc)'))}
			>
				<XIcon weight="bold" />
			</Button>
		</div>
	{:else}
		<button
			type="button"
			class={cn(
				interactive,
				'inline-flex min-h-9 w-full min-w-0 flex-nowrap items-center gap-1.5 rounded-md border px-3 py-1.5 text-left transition-colors',
				keys.length === 0
					? 'border-secondary-800/80 bg-secondary-950/40 text-secondary-500 hover:border-secondary-600 hover:bg-secondary-900/50'
					: 'border-secondary-800 bg-secondary-950/60 hover:border-secondary-600 hover:bg-secondary-900/50'
			)}
			onclick={() => shortcuts.record(keybinding, type)}
			{@attach tooltip(type === 'trigger' ? t('Record trigger keys') : t('Record action keys'))}
		>
			{#if keys.length === 0}
				<span class="text-sm italic">{t('Click to record')}</span>
			{:else}
				{#each keys as key, keyIndex (key)}
					{#if keyIndex > 0}
						<PlusIcon class="text-secondary-500 size-3 shrink-0" weight="bold" />
					{/if}
					<KeyCap>{formatKeyLabel(key)}</KeyCap>
				{/each}
			{/if}
		</button>
	{/if}
</div>
