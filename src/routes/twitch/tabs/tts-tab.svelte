<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { open, message } from '@tauri-apps/plugin-dialog';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$core/app';
	import { cn } from '$lib/utils';
	import { Checkbox, Input, Options, RadioGroup, Select } from '$lib/components/ui/input';
	import { Meter } from '$lib/components/ui/meter';
	import { dialog } from '$lib/components/ui/dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { fetch } from '@tauri-apps/plugin-http';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { watch } from 'runed';
	import { uniqBy } from 'lodash-es';

	const module = app.modules.get('twitch');

	let voiceName = $state.raw<string>('');
	let voiceFiles = $state.raw<string[]>([]);
	let isProcessing = $state.raw<boolean>(false);
	let availableVoices: { value: string; label: string; disabled: boolean }[] = $state.raw([]);

	watch(
		() => module.tts?.elevenlabs?.voices,
		(voices) => {
			if (!voices) {
				availableVoices = [];
				return;
			}

			availableVoices = uniqBy(
				voices.map((voice) => {
					return {
						value: voice.name!,
						label: voice.name!,
						disabled: false
					};
				}),
				'value'
			);
		}
	);
</script>

<Form.Root>
	<Form.Group>
		<Label>Enable TTS</Label>
		<Checkbox bind:checked={app.settings.twitch.tts.enabled} label="Enabled" />
	</Form.Group>
	<Form.Group>
		<Label>TTS Provider</Label>
		<div class="flex items-center gap-8">
			<RadioGroup
				name="provider"
				items={[
					{
						value: 'brian',
						label: 'Brian'
					},
					{
						value: 'elevenlabs',
						label: 'Elevenlabs'
					}
				]}
				direction="horizontal"
				bind:value={app.settings.twitch.tts.provider}
			/>
		</div>
	</Form.Group>
	<Form.Group>
		<Label>TTS message format</Label>
		<small class="text-secondary-400 -mt-2 mb-1 block">
			Available variables: <code>{`{username}`}</code>
			<code>{`{message}`}</code>
		</small>
		<Input
			placeholder={`{username} said, {message}`}
			name="ttsMessageFormat"
			type="text"
			bind:value={app.settings.twitch.tts.messageFormat}
		/>
	</Form.Group>
	{#if app.settings.twitch.tts.provider === 'elevenlabs'}
		<Form.Group>
			<Label>Elevenlabs API key</Label>
			<Input
				placeholder="Enter elevenlabs API key ..."
				name="elevenlabsApiKey"
				type="password"
				bind:value={app.settings.twitch.tts.elevenlabsApiKey}
			/>
		</Form.Group>
		{#if module.tts?.elevenlabs}
			{#if module.tts.elevenlabs.user}
				<div class="mb-4">
					<Meter
						label={module.tts.elevenlabs.user.subscription.tier}
						valueLabel={`${module.tts.elevenlabs.user.subscription.characterCount} / ${module.tts.elevenlabs.user.subscription.characterLimit}`}
						max={module.tts.elevenlabs.user.subscription.characterLimit}
						value={module.tts.elevenlabs.user.subscription.characterCount}
					/>
				</div>
			{/if}
			<Form.Group>
				<Label>Voice character</Label>
				<Select
					items={availableVoices}
					type="single"
					placeholder="Select voice"
					name="voiceName"
					bind:value={app.settings.twitch.tts.elevenlabs.voiceName}
				/>
			</Form.Group>
		{/if}
	{/if}
</Form.Root>

<!-- {#snippet addVoiceDialogContent()}
	<form
		onsubmit={async (e) => {
			isProcessing = true;

			try {
				e.preventDefault();

				const files = await Promise.all(voiceFiles.map(async (file) => await readFile(file)));

				const formData = new FormData();
				formData.append('name', '[PERSONALITY] ' + voiceName);

				files.forEach((file, index) => {
					const blob = new Blob([file], { type: 'audio/mpeg' });
					formData.append(`files`, blob, `voice-${index}.mp3`);
				});

				const request = await fetch('https://api.elevenlabs.io/v1/voices/add', {
					method: 'POST',
					headers: {
						'xi-api-key': module.tts?.twitch.settings.elevenlabsApiKey!
					},
					body: formData
				});
				const response = (await request.json()) as {
					voice_id: string;
					requires_verification: boolean;
				};

				if (!response) {
					return;
				}

				module.elevenlabs!.customVoices.push({
					files: voiceFiles,
					name: voiceName,
					voiceId: response.voice_id
				});

				await app.store.set('twitchCustomVoices', module.elevenlabs!.customVoices);
			} catch (error) {
			} finally {
				isProcessing = false;
				dialog.close();
			}
		}}
	>
		<div class="mb-4 flex flex-col gap-2">
			<Label>Voice name</Label>
			<Input placeholder="Enter voice name ..." name="name" type="text" bind:value={voiceName} />
		</div>
		<div class="mb-4 flex flex-col items-start gap-2">
			<Label>Audio files</Label>
			<Button
				onclick={async () => {
					const files = await open({
						multiple: true,
						filters: [{ name: 'Audio Files', extensions: ['mp3', 'm4a', 'ogg', 'wav'] }]
					});

					if (!files) {
						return;
					}

					voiceFiles = files;
				}}
				class="bg-secondary-950 text-white"
				type="button"
			>
				{voiceFiles.length ? `Selected ${voiceFiles.length} file(s)` : 'Select audio file(s)'}
			</Button>
		</div>
		<div class="flex flex-col items-end">
			<Button type="submit" variant="primary" loading={isProcessing}>Add custom voice</Button>
		</div>
	</form>
{/snippet}

<div class="mb-4 flex flex-col gap-2">
	<Label>TTS everything</Label>
	<Checkbox label="Enabled" name="enabled" bind:checked={module.settings.enabled} />
</div>
{#if module.settings.enabled}
	<div class="mb-4 flex flex-col gap-2">
		<Label>TTS Provider</Label>
		<div class="flex items-center gap-8">
			<RadioGroup
				name="provider"
				items={[
					{
						value: 'brian',
						label: 'Brian'
					},
					{
						value: 'elevenlabs',
						label: 'Elevenlabs'
					}
				]}
				direction="horizontal"
				bind:value={module.settings.provider}
			/>
		</div>
	</div>
	<div class="mb-4 flex flex-col">
		<Label>TTS message format</Label>
		<small class="text-secondary-400 mb-4 block">
			Available variables: <code>{`{username}`}</code>
			<code>{`{message}`}</code>
		</small>
		<Input
			placeholder={`{username} said, {message}`}
			name="ttsMessageFormat"
			type="text"
			bind:value={module.settings.ttsMessageFormat}
		/>
	</div>
	<div class={cn(module.settings.provider === 'brian' && 'hidden')}>
		<div class={cn('mb-4 flex flex-col gap-2')}>
			<Label>Elevenlabs API key</Label>
			<Input
				placeholder="Enter elevenlabs API key ..."
				name="elevenlabsApiKey"
				type="text"
				bind:value={module.settings.elevenlabsApiKey}
			/>
		</div>
		{#if module.elevenlabs && module.elevenlabs.user}
			<div class="mb-4">
				<Meter
					label={module.elevenlabs.user.subscription.tier}
					valueLabel={`${module.elevenlabs.user.subscription.characterCount} / ${module.elevenlabs.user.subscription.characterLimit}`}
					max={module.elevenlabs.user.subscription.characterLimit}
					value={module.elevenlabs.user.subscription.characterCount}
				/>
			</div>
		{/if}
		{#if module.elevenlabs}
			<div class={cn('mb-4 flex flex-col gap-2')}>
				<Label>Voice character</Label>
				<Select
					items={Array.from(
						new Map(module.elevenlabs!.voices.map((voice) => [voice.name!, voice])).values()
					).map((voice) => ({
						value: voice.name!,
						label: voice.name!,
						disabled: false
					}))}
					type="single"
					placeholder="Select voice"
					name="voiceName"
					bind:value={module.settings.voiceName}
				/>
			</div>
			<div class="mb-4 flex flex-col gap-2">
				<Label>Enable personal voices?</Label>
				<Checkbox
					label="Enabled"
					name="personalVoicesEnabled"
					bind:checked={module.settings.personalVoicesEnabled}
				/>
			</div>
			<div class={cn(module.settings.personalVoicesEnabled === false && 'hidden')}>
				<div class="mb-4 flex flex-col items-start">
					<Label>Add voice clones</Label>
					<small class="text-secondary-400 mb-2 block">
						Requires atleast 1 minute of audio playback of the voice for optimal result.
					</small>
					{#if module.tts?.twitch.elevenlabs?.customVoices.length}
						<div class="grid gap-[2px]">
							{#each module.tts.twitch.elevenlabs.customVoices as voice (voice.voiceId)}
								<span class="grid grid-cols-[1fr_2.5rem] gap-[2px]">
									<span class="bg-primary/5 w-64 px-4 py-2">{voice.name}</span>
									<button
										class="bg-secondary-800 hover:bg-secondary-900 cursor-pointer p-3"
										onclick={async () => {
											try {
												await module.tts?.twitch.elevenlabs?.client?.voices.delete(voice.voiceId);
											} catch (_) {
												console.error('Failed to delete voice:', _);
											} finally {
												module.elevenlabs!.customVoices = module.elevenlabs!.customVoices.filter(
													(v) => v.voiceId !== voice.voiceId
												);
												app.store.set('twitchCustomVoices', module.elevenlabs!.customVoices);
											}
										}}
									>
										<Trash />
									</button>
								</span>
							{/each}
						</div>
					{/if}
					<Button
						onclick={() => {
							dialog.open = true;
							dialog.title = 'Add custom voice';
							dialog.component = addVoiceDialogContent;
						}}
						variant="secondary"
						class="text-secondary-200 mt-[2px] px-4 text-sm font-normal"
					>
						Add new custom voice
					</Button>
					<Button onclick={selectFiles} variant="secondary">Select audio file(s)</Button>
				</div>
				<div class="mb-4 flex flex-col gap-2">
					<Label>Select voices</Label>
					<Select
						items={module.elevenlabs!.customVoices.map((voice) => ({
							value: voice.name!,
							label: voice.name!,
							disabled: false
						}))}
						type="multiple"
						placeholder="Select voice"
						name="personalVoices"
						bind:value={module.settings.personalVoices}
					/>
				</div>
				<div class="mb-4 flex flex-col gap-2">
					<Label>Rewarded voices</Label>
					<Options bind:value={module.tts!.personal.activeVoices} />
				</div>
			</div>
		{/if}
	</div>
{/if} -->
