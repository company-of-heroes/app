<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import Trash from 'phosphor-svelte/lib/TrashIcon';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { fetch } from '$core/http/fetch';
	import { app } from '$core/app/context';
	import { dialog } from '$lib/components/ui/dialog';
	import { tts } from '$features/twitch';
	import { ElevenlabsProvider } from '.';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
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
			app.toast.error(t('Please select at least one audio file.'));
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
					app.toast.info(
						t(
							'Voice added successfully, but it requires verification by ElevenLabs. Please check your email for further instructions.'
						)
					);
				}

				await provider.getVoices();

				isProcessing = false;
				app.toast.success(t('{voiceName} added successfully.', { voiceName }));
				dialog.close();
			} else {
				app.toast.error(t('Failed to add voice. Please try again.'));
				console.error(`ElevenLabs add voice: Invalid response ${JSON.stringify(response)}`);
			}
		} catch (err) {
			app.toast.error(t('Failed to add voice. Please try again.'));
			console.error(`ElevenLabs add voice: Invalid response ${JSON.stringify(err)}`);
			isProcessing = false;
		}
	}}
>
	<Form.Group label={t('Voice name')}>
		<Input
			placeholder={t('Enter voice name ...')}
			name="name"
			type="text"
			bind:value={voiceName}
			required
		/>
	</Form.Group>
	<Form.Group label={t('Audio files')}>
		<div class="flex w-full min-w-0 flex-col gap-2">
			{#each voiceFiles as file, index (file.name)}
				<span class="flex items-center gap-3">
					<span class="min-w-0 flex-1 truncate">{file.name}</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="text-destructive hover:text-destructive/80"
						onclick={() => {
							voiceFiles = voiceFiles.filter((_, i) => i !== index);
						}}
					>
						<Trash />
					</Button>
				</span>
			{/each}
			<Button
				onclick={async () => {
					files = await open({
						multiple: true,
						filters: [{ name: t('Audio Files'), extensions: ['mp3', 'm4a', 'ogg', 'wav'] }]
					});
					if (!files) {
						return;
					}

					voiceFiles = await Promise.all(files.map(async (file) => await readFile(file))).then(
						(data) => {
							return data.map((d: Uint8Array, index: number) => {
								const blob = new Blob([d], { type: 'audio/mpeg' });
								return new File([blob], `voice-${index}.mp3`);
							});
						}
					);
				}}
				variant="secondary"
				class="w-fit"
				type="button"
			>
				{voiceFiles.length
					? t('Selected {count} file(s)', { count: voiceFiles.length })
					: t('Select audio file(s)')}
			</Button>
		</div>
	</Form.Group>
	<Form.Group>
		<Button type="submit" class="w-fit" loading={isProcessing}>{t('Add Voice')}</Button>
	</Form.Group>
</Form.Root>
