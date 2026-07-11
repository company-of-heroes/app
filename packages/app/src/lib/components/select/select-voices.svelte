<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Selection } from '$lib/components/ui/input';
	import { Button } from '../ui/button';
	import { cn } from '$lib/utils';
	import PlayIcon from 'phosphor-svelte/lib/PlayIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import { tooltip } from '$lib/attachments';
	import { dialog } from '$lib/components/ui/dialog';
	import { tts } from '$core/app/features/twitch/tts';
	import VoiceAliasForm from './voice-alias-form.svelte';

	let {
		options,
		value = $bindable(),
		placeholder,
		icon
	}: ComponentProps<typeof Selection> = $props();

	let previewLoadingVoiceId = $state<string | null>(null);
	let editingVoiceId = $state<string | null>(null);
	let aliasDraft = $state('');

	function focusAliasInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function stopRowSelection(event: Event) {
		event.stopPropagation();
		event.preventDefault();
	}

	function getVoice(voiceId: string) {
		return tts.provider.voices.find((voice) => voice.voiceId === voiceId);
	}

	function getDisplayLabel(option: { value: string; label: string }) {
		const voice = getVoice(option.value);
		return voice ? tts.provider.getVoiceLabel(voice) : option.label;
	}

	function getListLabel(voiceId: string, fallback: string) {
		const voice = getVoice(voiceId);
		return voice?.alias?.trim() || fallback;
	}

	function startInlineAliasEdit(voiceId: string, event: Event) {
		stopRowSelection(event);

		const voice = getVoice(voiceId);
		if (!voice) return;

		editingVoiceId = voiceId;
		aliasDraft = voice.alias ?? '';
	}

	function openAliasDialog(voiceId: string, event: Event) {
		stopRowSelection(event);

		const voice = getVoice(voiceId);
		if (!voice) return;

		dialog.title = 'Edit voice alias';
		dialog.description = `Set a custom display name for ${voice.name}.`;
		dialog.setComponent(VoiceAliasForm, {
			alias: voice.alias ?? '',
			label: voice.name,
			onSave: (alias) => {
				tts.provider.setVoiceAlias(voiceId, alias);
				dialog.close();
			}
		});
		dialog.open = true;
	}

	function saveAlias(voiceId: string) {
		tts.provider.setVoiceAlias(voiceId, aliasDraft);
		editingVoiceId = null;
		aliasDraft = '';
	}

	function cancelAliasEdit() {
		editingVoiceId = null;
		aliasDraft = '';
	}
</script>

{#snippet child({ value, label }: { value: string; label: string })}
	{@const isEditing = editingVoiceId === value}
	<span class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-start">
		{#if isEditing}
			<input
				type="text"
				{@attach focusAliasInput}
				bind:value={aliasDraft}
				placeholder={label}
				class={cn(
					'border-secondary-700 bg-secondary-900 focus:border-secondary-500',
					'h-8 w-full min-w-0 rounded border px-2.5 text-sm outline-none'
				)}
				onclick={stopRowSelection}
				onmousedown={stopRowSelection}
				onpointerdown={stopRowSelection}
				onkeydown={(e) => {
					e.stopPropagation();

					if (e.key === 'Enter') {
						e.preventDefault();
						saveAlias(value);
					}

					if (e.key === 'Escape') {
						e.preventDefault();
						cancelAliasEdit();
					}
				}}
				onblur={(e) => {
					const related = e.relatedTarget;
					if (related instanceof Element && related.closest('[data-alias-actions]')) {
						return;
					}

					if (editingVoiceId === value) {
						saveAlias(value);
					}
				}}
			/>
		{:else}
			<span class="truncate">{getListLabel(value, label)}</span>
		{/if}
		<span class="flex items-center gap-1" data-alias-actions>
			<Button
				variant="secondary"
				size="icon-sm"
				{@attach tooltip(isEditing ? 'Save alias' : 'Edit alias')}
				onpointerdown={stopRowSelection}
				onmousedown={stopRowSelection}
				onclick={(e) => {
					if (isEditing) {
						stopRowSelection(e);
						saveAlias(value);
						return;
					}

					startInlineAliasEdit(value, e);
				}}
			>
				{#if isEditing}
					<CheckIcon weight="bold" />
				{:else}
					<PencilSimpleIcon />
				{/if}
			</Button>
			<Button
				variant="secondary"
				size="icon-sm"
				{@attach tooltip('Play preview')}
				onpointerdown={stopRowSelection}
				onmousedown={stopRowSelection}
				onclick={(e) => {
					stopRowSelection(e);

					previewLoadingVoiceId = value;

					tts
						.speak({
							message: `This is a preview of the ${label} voice. Hello friend! How are you doing today?`,
							voiceId: value
						})
						.finally(() => {
							if (previewLoadingVoiceId === value) {
								previewLoadingVoiceId = null;
							}
						});
				}}
				loading={previewLoadingVoiceId === value}
			>
				<PlayIcon />
			</Button>
		</span>
	</span>
{/snippet}

<Selection
	multiple
	options={options.map((option) => ({
		value: option.value,
		label: option.label,
		child
	}))}
	bind:value
	{placeholder}
	{icon}
	{getDisplayLabel}
	onEditSelected={openAliasDialog}
/>
