<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { fetch } from '@tauri-apps/plugin-http';
	import { app } from '$core/app/context';
	import { toast } from 'svelte-sonner';
	import { dialog } from '$lib/components/ui/dialog';
	import { tts } from '$features/twitch';
	import { ElevenlabsProvider } from '.';

	const provider = $derived(tts.provider as ElevenlabsProvider);

	let isProcessing = $state(false);
	let voiceName = $state('');
	let files = $state<string[] | null>([]);
	let voiceFiles = $state<File[]>([]);
</script>

<Form.Root
	onsubmit={async (e) => {
		e.preventDefault();

		if (voiceFiles.length === 0) {
			toast.error('Please select at least one audio file.');
			return;
		}

		isProcessing = true;

		try {
			const formData = new FormData();
			formData.append('name', voiceName);
			formData.append(
				'labels',
				JSON.stringify({
					isCustomVoice: 'true'
				})
			);

			voiceFiles.forEach((file) => {
				formData.append('files', file);
			});

			const request = await fetch('https://api.elevenlabs.io/v1/voices/add', {
				method: 'POST',
				headers: {
					'xi-api-key': app.settings.elevenlabsApiKey
				},
				body: formData
			});
			const response = (await request.json()) as {
				voice_id: string;
				requires_verification: boolean;
			};

			if (response && response.voice_id) {
				if (response.requires_verification) {
					toast.info(
						'Voice added successfully, but it requires verification by ElevenLabs. Please check your email for further instructions.'
					);
				}

				await provider.getVoices();

				isProcessing = false;
				toast.success(`${voiceName} added successfully.`);
				dialog.close();
			} else {
				toast.error('Failed to add voice. Please try again.');
				console.error(`ElevenLabs add voice: Invalid response ${JSON.stringify(response)}`);
			}
		} catch (err) {
			toast.error('Failed to add voice. Please try again.');
			console.error(`ElevenLabs add voice: Invalid response ${JSON.stringify(err)}`);
			isProcessing = false;
		}
	}}
>
	<Form.Group>
		<Label>Voice name</Label>
		<Input
			placeholder="Enter voice name ..."
			name="name"
			type="text"
			bind:value={voiceName}
			required
		/>
	</Form.Group>
	<Form.Group>
		<Label>Audio files</Label>
		<div class="grid gap-1">
			{#each voiceFiles as file, index}
				<span class="grid grid-flow-col gap-4 rounded bg-gray-700 px-3 py-1">
					<span class="truncate">{file.name}</span>
					<button
						type="button"
						class="ms-auto cursor-pointer rounded text-red-400 transition-colors hover:text-red-500"
						onclick={() => {
							voiceFiles = voiceFiles.filter((_, i) => i !== index);
						}}
					>
						<Trash />
					</button>
				</span>
			{/each}
		</div>
		<Button
			onclick={async () => {
				files = await open({
					multiple: true,
					filters: [{ name: 'Audio Files', extensions: ['mp3', 'm4a', 'ogg', 'wav'] }]
				});

				if (!files) {
					return;
				}

				voiceFiles = await Promise.all(files.map(async (file) => await readFile(file))).then(
					(data) => {
						return data.map((d: Uint8Array<ArrayBuffer>, index: number) => {
							const blob = new Blob([d], { type: 'audio/mpeg' });
							return new File([blob], `voice-${index}.mp3`);
						});
					}
				);
			}}
			class="bg-secondary-950 w-fit text-white"
			type="button"
		>
			{voiceFiles.length ? `Selected ${voiceFiles.length} file(s)` : 'Select audio file(s)'}
		</Button>
	</Form.Group>
	<Form.Group class="items-end">
		<Button type="submit" class="w-fit" loading={isProcessing}>Add Voice</Button>
	</Form.Group>
</Form.Root>
