import { app } from '$core/app';
import { watch } from 'runed';
import Elevenlabs from './elevenlabs.svelte';
import { TTSProvider } from './provider.svelte';
import { tts } from '../tts.svelte';
import { isEmpty, uniqBy } from 'lodash-es';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export class ElevenlabsProvider extends TTSProvider {
	name = 'elevenlabs';

	component = Elevenlabs;

	client: ElevenLabsClient | null = null;

	init(): Promise<void> | void {
		$effect.root(() => {
			watch(
				[() => tts.settings.enabled, () => app.settings.elevenlabsApiKey],
				([enabled, apiKey], [prevEnabled, prevApiKey]) => {
					if (!apiKey) {
						app.toast.error(
							'Disabled TTS automatically, Elevenlabs API key is required when Elevenlabs provider is enabled.'
						);
						tts.settings.enabled = false;
						return;
					}

					if (apiKey && !enabled && prevEnabled === false && isEmpty(prevApiKey)) {
						tts.settings.enabled = true;
					}

					this.client = new ElevenLabsClient({ apiKey });
					this.getVoices();
				}
			);
		});
	}

	async getVoices() {
		if (!this.client) {
			return;
		}

		const { voices } = await this.client.voices.getAll();

		this.voices = uniqBy(voices, 'name').map((voice) => ({
			voiceId: voice.voiceId,
			name: voice.name!
		}));
	}
}
