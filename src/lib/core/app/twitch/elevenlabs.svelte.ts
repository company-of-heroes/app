import type { Voice, User } from '@elevenlabs/elevenlabs-js/api';
import { app } from '$core/app';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { watch } from 'runed';
import { Module } from '$lib/modules/module.svelte';

export type CustomVoice = {
	files: string[];
	name: string;
	voiceId: string;
};

export class ElevenLabs extends Module {
	enabled = $derived(
		app.settings.twitch.tts.enabled && app.settings.twitch.tts.elevenlabsApiKey !== ''
	);

	client: ElevenLabsClient | undefined = $state(undefined);

	voices: Voice[] = $state([]);

	customVoices: CustomVoice[] = $state([]);

	user: User | undefined = $state(undefined);

	async init() {
		this.client = new ElevenLabsClient({ apiKey: app.settings.twitch.tts.elevenlabsApiKey });

		$effect.root(() => {
			watch(
				() => app.settings.twitch.tts.elevenlabsApiKey,
				() => {
					if (app.settings.twitch.tts.elevenlabsApiKey) {
						this.client = new ElevenLabsClient({
							apiKey: app.settings.twitch.tts.elevenlabsApiKey
						});
						this.getData();
					} else {
						this.client = undefined;
					}
				}
			);
		});
	}

	async getData() {
		const voicesResponse = await this.client?.voices.getAll();

		this.voices = voicesResponse?.voices || [];
		this.user = await this.client?.user.get();
		this.customVoices = (await app.store.get<CustomVoice[]>('twitchCustomVoices')) || [];

		// const voicesToRemove = this.voices.filter(
		// 	(v) => v.name?.startsWith('Statement') || v.name?.startsWith('Xcom')
		// );

		// voicesToRemove.forEach((v) => {
		// 	this.client?.voices.delete(v.voiceId);
		// });
	}

	async destroy() {}
}
