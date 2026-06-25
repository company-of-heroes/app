<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Selection } from '$lib/components/ui/input';
	import { Button } from '../ui/button';
	import { Input } from '../ui/input';
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
		event.stopPropagation();
		event.preventDefault();

		const voice = getVoice(voiceId);
		if (!voice) return;

		editingVoiceId = voiceId;
		aliasDraft = voice.alias ?? '';
	}

	function openAliasDialog(voiceId: string, event: Event) {
		event.stopPropagation();

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
	<span class="grid w-full grid-cols-[1fr_auto] items-center gap-4 text-start">
		{#if isEditing}
			<Input
				class="h-8 min-w-0 py-1 text-sm"
				bind:value={aliasDraft}
				placeholder={label}
				onclick={(e) => e.stopPropagation()}
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
				onblur={() => {
					if (editingVoiceId === value) {
						saveAlias(value);
					}
				}}
			/>
		{:else}
			<span class="truncate">{getListLabel(value, label)}</span>
		{/if}
		<span class="flex items-center gap-1">
			<Button
				variant="secondary"
				size="icon-sm"
				{@attach tooltip(isEditing ? 'Save alias' : 'Edit alias')}
				onclick={(e) => {
					if (isEditing) {
						e.stopPropagation();
						e.preventDefault();
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
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();

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
