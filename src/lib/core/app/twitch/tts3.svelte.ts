import type { ChatMessage } from '@twurple/chat';
import type { Listener } from '@d-fischer/typed-event-emitter';
import type { VoiceSettings } from '@elevenlabs/elevenlabs-js/api';
import type { Twitch } from './twitch3.svelte';
import { app } from '$core/app';
import { translate } from 'google-translate-api-x';
import { fetch } from '@tauri-apps/plugin-http';
import { Module, type ModuleEvents } from '$lib/modules/module.svelte';
import { ElevenLabs } from './elevenlabs2.svelte';
import { TTSPersonalVoices } from './tts-personal-voices2.svelte';
import type { DebugOptions } from 'emittery';

export interface TTSOptions {
	message: string;
	user?: string;
	voiceId?: string;
	provider?: 'elevenlabs' | 'brian';
	skipUserFormat?: boolean;
}

/**
 * Text-to-Speech (TTS) module for Twitch chat integration.
 * Provides audio playback of chat messages using various TTS providers.
 */
export class TTS {
	public enabled = $derived(app.settings.twitch.enabled && app.settings.twitch.tts.enabled);
	public channel = $derived.by(() => this.twitch.tokenInfo?.userName || '');
	public elevenlabs: ElevenLabs | undefined = $state(undefined);
	public personalVoices: TTSPersonalVoices | undefined = $state(undefined);
	public isPlaying = $state(false);
	public queue = $state<Blob[]>([]);

	private readonly twitch = $derived(app.modules.get('twitch'));
	private readonly audioContext = new AudioContext();
	private chatListener: Listener | undefined;
	private playIntervalId: number | undefined;
	private lastMessageUser: string | null = null;
	private lastMessageUserTimeout: NodeJS.Timeout | null = null;

	async init() {
		this.startPlaybackLoop();
		this.chatListener = this.twitch.chatClient?.onMessage((channel, user, text, msg) =>
			this.handleChatMessage(channel, user, text, msg)
		);
		this.elevenlabs = await new ElevenLabs().register();
		this.personalVoices = await new TTSPersonalVoices().register();
	}

	/**
	 * Generate and queue TTS audio from anywhere in the application.
	 * @param options - TTS generation options
	 * @example
	 * // Simple usage
	 * tts.speak({ message: "Hello world" });
	 *
	 * // With specific voice and user
	 * tts.speak({
	 *   message: "Welcome to the stream",
	 *   user: "StreamBot",
	 *   voiceId: "custom-voice-id"
	 * });
	 */
	async speak(options: TTSOptions): Promise<void> {
		const {
			message,
			user = 'System',
			voiceId,
			provider = app.settings.twitch.tts.provider,
			skipUserFormat = false
		} = options;

		if (!message?.trim()) return;

		const resolvedVoiceId = voiceId || this.getVoiceForUser(user);
		const formattedMessage = skipUserFormat ? message : this.formatMessage(message, user);

		if (provider === 'elevenlabs') {
			await this.generateElevenLabsAudio(formattedMessage, user, resolvedVoiceId);
		} else if (provider === 'brian') {
			await this.generateBrianAudio(formattedMessage);
		}
	}

	/**
	 * Clear the audio queue and stop playback.
	 */
	clearQueue(): void {
		this.queue = [];
		this.isPlaying = false;
	}

	/**
	 * Skip the currently playing audio.
	 */
	skip(): void {
		if (this.isPlaying) {
			this.audioContext.suspend();
			setTimeout(() => {
				this.audioContext.resume();
				this.isPlaying = false;
			}, 100);
		}
	}

	private async handleChatMessage(
		channel: string,
		user: string,
		message: string,
		msg: ChatMessage
	): Promise<void> {
		this.previewTtsVoice(message, user);
		if (!this.shouldProcessMessage(message, user)) return;

		this.clearLastUserTimeout();

		const voiceId = this.getVoiceForUser(user);
		const formattedMessage = this.formatMessageForUser(message, user);
		const provider = app.settings.twitch.tts.provider;

		await this.speak({
			message: formattedMessage,
			user,
			voiceId,
			provider,
			skipUserFormat: true
		});

		this.lastMessageUser = user;
	}

	private previewTtsVoice(message: string, user: string) {
		if (!message?.trim()) return;
		if (!message.startsWith('!preview')) return;
		if (app.settings.twitch.tts.provider !== 'elevenlabs') return;

		const voiceId = message.replace('!preview', '').trim();

		if (!voiceId) return;

		const previewMessage = `Hello, ${user}, this is a preview of my lovely voice. If you like it, you can select it for your messages!!.`;
		this.speak({
			message: previewMessage,
			user,
			voiceId,
			provider: 'elevenlabs',
			skipUserFormat: true
		});
	}

	private shouldProcessMessage(message: string, user: string): boolean {
		return message.length > 0 && !message.startsWith('!') && !user.includes('bot');
	}

	private clearLastUserTimeout(): void {
		if (this.lastMessageUserTimeout) {
			clearTimeout(this.lastMessageUserTimeout);
		}
	}

	private getVoiceForUser(user: string): string {
		const personalVoice = app.settings.twitch.tts.personalVoices.rewardedVoices.find(
			(rv) => rv.user.toLowerCase() === user.toLowerCase()
		)?.voiceId;

		if (personalVoice) return personalVoice;

		const defaultVoiceName = app.settings.twitch.tts.elevenlabs.voiceName;
		const defaultVoice = this.elevenlabs?.voices?.find((v) => v.name === defaultVoiceName);

		if (defaultVoice) return defaultVoice.voiceId;

		const fallbackVoice = this.elevenlabs?.voices?.find((v) => v.name === 'George');
		return fallbackVoice?.voiceId || '';
	}

	private formatMessageForUser(message: string, user: string): string {
		const shouldPronounceUser = user !== this.lastMessageUser;
		if (!shouldPronounceUser) return message;

		return this.formatMessage(message, user);
	}

	private formatMessage(message: string, user: string): string {
		const format = app.settings.twitch.tts.messageFormat || '{user} said, {message}';
		const alias = this.getUserAlias(user);

		return format.replace(/\{(username|user)\}/g, alias).replace(/\{(message|msg)\}/g, message);
	}

	private getUserAlias(username: string): string {
		const alias = app.settings.twitch.tts.aliases.find(
			(a) => a.username.toLowerCase() === username.toLowerCase()
		);
		return alias?.alias || username;
	}

	// ===== TTS Providers =====
	private async generateElevenLabsAudio(
		message: string,
		user: string,
		voiceId: string
	): Promise<void> {
		if (!voiceId) {
			console.error('No valid voice found. Cannot proceed with TTS.');
			return;
		}

		const voiceName = this.elevenlabs?.voices.find((v) => v.voiceId === voiceId)?.name;
		const voiceSettings = this.getVoiceSettings(voiceName);
		const translatedMessage = await this.translateMessageIfNeeded(message, voiceName);

		try {
			const audioStream = (await this.elevenlabs?.client?.textToSpeech.stream(voiceId, {
				text: translatedMessage,
				modelId: 'eleven_multilingual_v2',
				enableLogging: false,
				outputFormat: 'mp3_44100_192',
				voiceSettings
			})) as unknown as ReadableStream;

			await this.processAudioStream(audioStream);
			await this.cleanupElevenLabsHistory();
		} catch (error) {
			console.error('Error generating ElevenLabs audio:', error);
		}
	}

	private async generateBrianAudio(message: string): Promise<void> {
		if (message.includes('http://') || message.includes('https://')) return;

		const sanitizedMessage = message.replaceAll('%', 'percent');

		try {
			const response = await fetch(
				`https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(sanitizedMessage)}`
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

			this.queue.push(audioBlob);

			if (!this.isPlaying) {
				this.playNext();
			}
		} catch (error) {
			console.error('Error generating Brian audio:', error);
		}
	}

	private getVoiceSettings(voiceName?: string): VoiceSettings {
		if (voiceName === 'Adolf') {
			return {
				stability: 0.6,
				similarityBoost: 1,
				style: 0.3,
				useSpeakerBoost: true
			};
		}

		return {
			stability: 0.3,
			similarityBoost: 1,
			style: 0.6,
			useSpeakerBoost: true
		};
	}

	private async translateMessageIfNeeded(message: string, voiceName?: string): Promise<string> {
		try {
			if (voiceName === 'Adolf') {
				const response = await translate(message, {
					to: 'de',
					requestFunction: fetch,
					requestOptions: { method: 'GET' }
				});
				return response.text;
			}

			if (voiceName === 'Simply') {
				return await this.translateShortWords(message);
			}
		} catch (error) {
			console.error('Error translating message:', error);
		}

		return message;
	}

	private async translateShortWords(message: string): Promise<string> {
		try {
			const words = message.split(' ');
			const wordsToTranslate = words.filter((word) => word.length === 2);

			if (wordsToTranslate.length === 0) return message;

			const textToTranslate = wordsToTranslate.join('\n');
			const response = await translate(textToTranslate, {
				to: 'de',
				requestFunction: fetch,
				requestOptions: { method: 'GET' }
			});

			const translatedWords = response.text.split('\n');
			const translationMap = new Map<string, string>();

			wordsToTranslate.forEach((word, index) => {
				if (translatedWords[index]) {
					translationMap.set(word, translatedWords[index]);
				}
			});

			return words.map((word) => translationMap.get(word) || word).join(' ');
		} catch (error) {
			console.error('Error translating short words:', error);
			return message;
		}
	}

	private async processAudioStream(audioStream: ReadableStream): Promise<void> {
		const chunks: Uint8Array[] = [];
		const reader = audioStream.getReader();

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// @ts-ignore
				this.queue.push(new Blob(chunks, { type: 'audio/mpeg' }));

				if (!this.isPlaying) {
					this.playNext();
				}
				break;
			}

			if (value) {
				chunks.push(value);
			}
		}
	}

	private async cleanupElevenLabsHistory(): Promise<void> {
		try {
			const { history } = (await this.elevenlabs?.client?.history.list()) || { history: [] };
			if (history.length > 0) {
				await this.elevenlabs?.client?.history.delete(history[0].historyItemId);
			}
		} catch (error) {
			console.error('Failed to cleanup ElevenLabs history:', error);
		}
	}

	private startPlaybackLoop(): void {
		const checkQueue = async () => {
			if (!this.isPlaying && this.queue.length > 0) {
				await this.playNext();
			}
			this.playIntervalId = window.setTimeout(checkQueue, 250);
		};
		checkQueue();
	}

	private async playNext(): Promise<void> {
		if (this.isPlaying || this.queue.length === 0) return;

		const audio = this.queue.shift();
		if (!audio) return;

		this.isPlaying = true;

		try {
			const arrayBuffer = await audio.arrayBuffer();

			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume();
			}

			const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
			const source = this.audioContext.createBufferSource();

			source.buffer = audioBuffer;
			source.connect(this.audioContext.destination);
			source.onended = () => {
				this.isPlaying = false;
			};

			source.start(0);
		} catch (error) {
			console.error('Error playing audio:', error);
			this.isPlaying = false;
		}
	}

	destroy(): void {
		if (this.playIntervalId) {
			clearInterval(this.playIntervalId);
			this.playIntervalId = undefined;
		}

		if (this.lastMessageUserTimeout) {
			clearTimeout(this.lastMessageUserTimeout);
			this.lastMessageUserTimeout = null;
		}

		if (this.chatListener) {
			this.chatListener.unbind();
			this.chatListener = undefined;
		}

		this.clearQueue();
		this.elevenlabs?.destroy();
		this.personalVoices?.destroy();
	}
}
