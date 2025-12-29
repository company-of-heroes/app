import { app } from '$core/context';
import { watch } from 'runed';
import Elevenlabs from './elevenlabs.svelte';
import { TTSProvider, type TTSVoice } from '../provider.svelte';
import { tts } from '$features/twitch';
import { defaultsDeep, isEmpty, isString, uniqBy } from 'lodash-es';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import translate from 'google-translate-api-x';
import { fetch } from '@tauri-apps/plugin-http';

export class ElevenlabsProvider extends TTSProvider {
	name = 'elevenlabs';

	component = Elevenlabs;

	client: ElevenLabsClient | null = null;

	customVoices: TTSVoice[] = $state([]);

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

					if (!isString(apiKey) || apiKey.trim() === '') {
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

		this.customVoices = voices
			.filter((v) => v.labels?.isCustomVoice === 'true')
			.map((voice) => ({
				voiceId: voice.voiceId,
				name: voice.name!
			}));

		app.settings.elevenlabsVoiceTunings = defaultsDeep(
			app.settings.elevenlabsVoiceTunings || {},
			this.customVoices.reduce(
				(acc, voice) => {
					acc[voice.voiceId] = {
						stability: 0.5,
						similarity_boost: 0.75,
						style: 0,
						speed: 1,
						use_speaker_boost: true,
						translate: false,
						translate_language: 'en',
						translate_random_words: false
					};
					return acc;
				},
				{} as Record<string, any>
			)
		);
	}

	deleteVoice(voiceId: string) {
		if (!this.client) {
			throw new Error('Elevenlabs client is not initialized');
		}

		return this.client.voices.delete(voiceId).then(() => this.getVoices());
	}

	async synthesize(message: string, voiceId?: string): Promise<Blob> {
		if (!this.client) {
			throw new Error('Elevenlabs client is not initialized');
		}

		const voiceSettings = app.settings.elevenlabsVoiceTunings?.[voiceId || ''] || undefined;

		if (voiceSettings?.translate) {
			if (voiceSettings.translate_random_words) {
				const words = message.split(' ');
				const shouldTranslate = (word: string) => {
					const cleanWord = word.replace(/[^\w]/g, '');
					return cleanWord.length === 2;
				};

				const wordsToTranslate = words.filter(shouldTranslate);

				if (wordsToTranslate.length > 0) {
					const translatedWords = await Promise.all(
						wordsToTranslate.map(async (word) => {
							const { text } = await translate(word, {
								to: voiceSettings.translate_language || 'en',
								requestFunction: fetch
							});
							return { original: word, translated: text };
						})
					);

					const translationMap = new Map(
						translatedWords.map(({ original, translated }) => [original, translated])
					);

					message = words.map((word) => translationMap.get(word) ?? word).join(' ');
				}
			} else {
				const { text } = await translate(message, {
					to: voiceSettings.translate_language || 'en',
					requestFunction: fetch
				});

				message = text;
			}
		}

		const audioStream = await this.client.textToSpeech.convert(
			voiceId || tts.provider.defaultVoiceId,
			{
				text: message,
				modelId: 'eleven_v3',
				enableLogging: false,
				voiceSettings
			}
		);

		// Convert ReadableStream to Blob
		const reader = audioStream.getReader();
		const chunks: Uint8Array[] = [];

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			if (value) {
				chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
			}
		}

		return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
	}
}
