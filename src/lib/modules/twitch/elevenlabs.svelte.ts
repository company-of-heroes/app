import type { Voice, User } from '@elevenlabs/elevenlabs-js/api';
import { app } from '$core/app';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Bootable } from '../bootable.svelte';
import { watch } from 'runed';
import type { files } from '$service-worker';

export type CustomVoice = {
	files: string[];
	name: string;
	voiceId: string;
};

export class ElevenLabs extends Bootable {
	enabled = $derived(!!app.settings.twitch?.enabled && !!app.settings.twitch.elevenlabsApiKey);

	client: ElevenLabsClient | undefined = $state(undefined);

	voices: Voice[] = $state([]);

	customVoices: CustomVoice[] = $state([]);

	user: User | undefined = $state(undefined);

	async init() {
		this.client = new ElevenLabsClient({ apiKey: app.settings.twitch?.elevenlabsApiKey });

		$effect.root(() => {
			watch(
				() => app.settings.twitch?.elevenlabsApiKey,
				() => {
					if (app.settings.twitch?.elevenlabsApiKey) {
						this.client = new ElevenLabsClient({ apiKey: app.settings.twitch.elevenlabsApiKey });
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

		this.voices = voicesResponse?.voices ?? [];
		this.user = await this.client?.user.get();
		this.customVoices = (await app.store.get<CustomVoice[]>('twitchCustomVoices')) || [];

		const voicesToRemove = this.voices.filter(
			(v) => v.name?.startsWith('Statement') || v.name?.startsWith('Xcom')
		);

		voicesToRemove.forEach((v) => {
			this.client?.voices.delete(v.voiceId);
		});
	}

	async destroy() {}
}
