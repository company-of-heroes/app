import type { ChatMessage } from '@twurple/chat';
import type { TTSVoice } from './providers/provider.svelte.js';
import { Plugin } from '$plugins/plugin.svelte';
import { twitch } from '$plugins/twitch';
import { watch } from 'runed';
import { stripEmotes } from '$lib/utils';
import { StreamElementsProvider } from './providers/streamelements.svelte.js';
import { ElevenlabsProvider } from './providers/elevenlabs';

export type TTSSettings = {
	provider: string;
	announceUser: 'always' | 'onlyOnce';
	messageFormat: string;
	voiceId: string | null;
	aliases: { username: string; alias: string }[];
	providers: {
		[key: string]: any;
	};
};

export type TTSEvents = {
	speak: { message: string; user: string; voiceId?: string };
};

export interface TTSOptions {
	message: string;
	user: string;
	voiceId?: string;
}

export class TTS extends Plugin<TTSSettings, TTSEvents> {
	public name = 'text-to-speech';

	public lastMessageUser: string | null = null;

	public isPlaying: boolean = $state(false);

	public providers = $state([new StreamElementsProvider(), new ElevenlabsProvider()]);

	public provider = $derived.by(() => {
		return (
			this.providers.find((provider) => provider.name === this.settings.provider) ||
			this.providers[0]
		);
	});

	public queue: Blob[] = $state([]);

	private playIntervalId: number | undefined;

	private readonly audioContext = new AudioContext();

	public async enable() {
		watch(
			() => twitch.chatClient,
			() => {
				if (!twitch.chatClient) {
					return;
				}

				twitch.on('chat-message', ({ user, message, msg }) =>
					this.handleMessage(user, message, msg)
				);

				this.startPlayback();
			}
		);

		watch(
			() => [this.settings.provider, this.provider.defaultVoiceId],
			() => {
				this.settings.voiceId = this.provider.defaultVoiceId;
			}
		);
	}

	private async handleMessage(user: string, text: string, msg: ChatMessage) {
		if (text.startsWith('!')) {
			this.handleCommand(user, text);
			return;
		}

		if (user.includes('bot')) {
			return;
		}

		let format = this.settings.messageFormat || '{message}';

		if (this.settings.announceUser === 'always') {
			format = '{username} said: ' + format;
		}

		if (this.settings.announceUser === 'onlyOnce' && this.lastMessageUser !== user) {
			format = '{username} said: ' + format;
		}

		const alias = this.getAliasedUser(user);
		const message = format
			.replace(/\{(username|user)\}/g, alias)
			.replace(/\{(message|msg)\}/g, stripEmotes(text, msg));

		this.lastMessageUser = user;

		const speakOptions: TTSOptions = {
			message,
			user,
			voiceId: this.settings.voiceId || undefined
		};

		await this.emit('speak', speakOptions);
		this.speak(speakOptions);
	}

	public async speak(options: TTSOptions): Promise<void> {
		const { message, voiceId } = options;

		const audio = await this.provider.synthesize(message, voiceId);

		this.queue.push(audio);
		if (!this.isPlaying) {
			this.playNext();
		}
	}

	public getAliasedUser(user: string): string {
		const aliasEntry = this.settings.aliases.find(
			(alias) => alias.username.toLowerCase() === user.toLowerCase()
		);
		return aliasEntry ? aliasEntry.alias : user;
	}

	public setAlias(user: string, alias: string) {
		const aliasEntryIndex = this.settings.aliases.findIndex(
			(a) => a.username.toLowerCase() === user.toLowerCase()
		);

		if (aliasEntryIndex !== -1) {
			this.settings.aliases[aliasEntryIndex].alias = alias;
		} else {
			this.settings.aliases.push({ username: user, alias });
		}
	}

	public handleCommand(user: string, command: string) {
		const parts = command.slice(1).split(' ');
		const cmd = parts[0].toLowerCase();
		const args = parts.slice(1);

		if (cmd === 'alias' && args.length >= 1) {
			this.setAlias(user, args[0]);
		}
	}

	public async disable() {
		if (this.playIntervalId) {
			clearTimeout(this.playIntervalId);
			this.playIntervalId = undefined;
		}

		this.queue = [];
		this.isPlaying = false;
	}

	public defaultSettings(): TTSSettings {
		return {
			provider: 'brian',
			announceUser: 'onlyOnce',
			messageFormat: '{message}',
			voiceId: null,
			aliases: [],
			providers: this.providers.reduce(
				(acc, provider) => {
					acc[provider.name] = {};
					return acc;
				},
				{} as Record<string, any>
			)
		};
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

	private startPlayback(): void {
		const checkQueue = async () => {
			if (!this.isPlaying && this.queue.length > 0) {
				await this.playNext();
			}
			this.playIntervalId = window.setTimeout(checkQueue, 250);
		};
		checkQueue();
	}
}

export const tts = new TTS();
