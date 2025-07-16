import type { Voice, User } from '@elevenlabs/elevenlabs-js/api';
import { app } from '$core/app';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Bootable } from '../bootable.svelte';

export class ElevenLabs extends Bootable {
	enabled = $derived(!!app.settings.twitch?.enabled && !!app.settings.twitch.elevenlabsApiKey);

	client: ElevenLabsClient | undefined = $state(undefined);

	voices: Voice[] = $state([]);

	user: User | undefined = $state(undefined);

	async init() {
		this.client = new ElevenLabsClient({ apiKey: app.settings.twitch?.elevenlabsApiKey });

		const voicesResponse = await this.client?.voices.getAll();
		this.voices = voicesResponse?.voices ?? [];
		this.user = await this.client?.user.get();
	}

	async destroy() {}
}
