import type { Voice as ElevenlabsVoice, User } from '@elevenlabs/elevenlabs-js/api';
import { app } from '$core/app';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { watch } from 'runed';
import { Module } from '$lib/modules/module.svelte';
import { uniqBy } from 'lodash-es';

export type CustomVoice = {
	files: string[];
	name: string;
	voiceId: string;
};

export type Voice = ElevenlabsVoice & {
	isDeleting?: boolean;
};

export class ElevenLabs extends Module {
	enabled = $derived(
		app.settings.twitch.tts.enabled && app.settings.twitch.tts.elevenlabsApiKey !== ''
	);

	client: ElevenLabsClient | undefined = $state(undefined);

	voices: Voice[] = $state([]);

	customVoices: Voice[] = $derived.by(
		() => this.voices.filter((v) => v.labels?.isCustomVoice === 'true') || []
	);

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
						this.refresh();
					} else {
						this.client = undefined;
					}
				}
			);
		});
	}

	async refresh() {
		const voicesResponse = await this.client?.voices.getAll();

		this.voices = uniqBy(voicesResponse?.voices, 'name') || [];
		this.user = await this.client?.user.get();
	}

	async deleteVoice(voiceId: string) {
		return this.client?.voices.delete(voiceId);
	}

	async destroy() {}
}
