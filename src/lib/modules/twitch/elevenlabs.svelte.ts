import { app } from '$lib/state/app.svelte';
import { ElevenLabsClient } from 'elevenlabs';
import type { Voice, User } from 'elevenlabs/api';
import { watch } from 'runed';
import { Bootable } from '../bootable.svelte';

export class ElevenLabs extends Bootable {
	enabled = $derived(!!app.settings.twitch?.enabled && !!app.settings.twitch.elevenlabsApiKey);

	client: ElevenLabsClient | undefined = $state(undefined);

	voices: Voice[] = $state([]);

	user: User | undefined = $state(undefined);

	async init() {
		this.client = new ElevenLabsClient({ apiKey: app.settings.twitch?.elevenlabsApiKey });

		const response = await this.client?.voices.getAll();
		this.voices = response?.voices ?? [];
		this.user = await this.client?.user.get();
	}

	async destroy() {}
}
