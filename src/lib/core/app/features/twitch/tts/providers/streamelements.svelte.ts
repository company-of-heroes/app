import type { Component } from 'svelte';
import { TTSProvider } from './provider.svelte';
import Streamelements from './streamelements.svelte';

export type StreamElementsVoice = {
	gender: 'Female' | 'Male';
	id: string;
	languageCode: string;
	languageName: string;
	name: string;
	provider: 'polly' | 'google' | 'azure';
	new?: boolean;
};

export type StreamElementsVoicesResponse = {
	voices: Record<string, StreamElementsVoice>;
};

export class StreamElementsProvider extends TTSProvider {
	name = 'StreamElements';

	defaultVoiceId = 'Brian';

	async init() {
		const request = await fetch('https://api.streamelements.com/kappa/v2/speech/voices?lang=en');
		const data: StreamElementsVoicesResponse = await request.json();

		const voices: StreamElementsVoice[] = [];

		for (const key in data.voices) {
			voices.push(data.voices[key]);
		}

		this.voices = voices
			.filter((voice) => voice.languageCode.startsWith('en'))
			.map((voice) => ({
				voiceId: voice.id,
				name: voice.name
			}));
	}

	async synthesize(message: string, voiceId?: string) {
		if (!voiceId) {
			voiceId = this.defaultVoiceId;
		}

		const response = await fetch(
			`https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(message)}`
		);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

		return audioBlob;
	}
}
