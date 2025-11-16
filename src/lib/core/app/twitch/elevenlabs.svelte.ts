import type { User, Voice as ElevenlabsVoice } from '@elevenlabs/elevenlabs-js/api';
import { watch } from 'runed';
import { Plugin } from '../plugin.svelte';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export type ElevenLabsSettings = {
	apiKey: string;
	voiceId: string;
};

export type Voice = ElevenlabsVoice & {
	isDeleting?: boolean;
};

export class ElevenLabs extends Plugin<ElevenLabsSettings> {
	name = 'elevenlabs-tts-provider';

	client: ElevenLabsClient | undefined = $state(undefined);

	user: User | undefined = $state(undefined);

	voices: Voice[] = $state([]);

	customVoices: Voice[] = $derived.by(
		() => this.voices.filter((v) => v.labels?.isCustomVoice === 'true') || []
	);

	async enable() {
		watch(
			() => [this.enabled, this.settings.apiKey],
			() => {
				if (this.enabled && this.settings.apiKey) {
					console.log('ElevenLabs TTS Provider enabled');
					this.client = new ElevenLabsClient({ apiKey: this.settings.apiKey });

					this.getUser();
					this.getVoices();
				} else {
					this.disable();
				}
			}
		);
	}

	getUser() {
		return this.client?.user.get().then((user) => (this.user = user));
	}

	getVoices() {
		return this.client?.voices.getAll().then(({ voices }) => (this.voices = voices));
	}

	deleteVoice(voice: Voice) {
		voice.isDeleting = true;

		this.client?.voices
			.delete(voice.voiceId)
			.then(() => {
				this.voices = this.voices.filter((v) => v.voiceId !== voice.voiceId);
			})
			.finally(() => {
				voice.isDeleting = false;
			});
	}

	async disable() {
		this.client = undefined;
		this.user = undefined;
		this.voices = [];
	}

	defaultSettings(): ElevenLabsSettings {
		return {
			apiKey: '',
			voiceId: ''
		};
	}
}

export const elevenlabs = new ElevenLabs();
