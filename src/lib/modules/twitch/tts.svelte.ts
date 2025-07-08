import type { ChatMessage } from '@twurple/chat';
import type { VoiceSettings } from 'elevenlabs/api';
import type { Listener } from '@d-fischer/typed-event-emitter';
import { app } from '$lib/state/app.svelte';
import { Module } from '../module.svelte';
import { translate } from 'google-translate-api-x';
import { fetch } from '@tauri-apps/plugin-http';
import type { Twitch } from './twitch.svelte';
import { TTSPersonal } from './tts-personal.svelte';
import { watch } from 'runed';

/**
 * Represents the Text-to-Speech (TTS) module.
 * Handles TTS initialization and potentially interaction with TTS services.
 */
export class TTS {
	/**
	 * Indicates whether the TTS module is enabled.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	enabled = $derived(
		app.settings.twitch?.enabled &&
			!!app.settings.twitch?.provider &&
			!!app.settings.twitch.voiceName
	);

	/**
	 * The Twitch channel to connect to for TTS messages.
	 * Derived from application settings.
	 *
	 * @readonly
	 * @type {string}
	 */
	channel = $derived(app.settings.twitch?.channel);

	/**
	 * The ElevenLabs API client instance.
	 * Undefined until initialized.
	 *
	 * @public
	 * @type {ElevenLabsClient | undefined}
	 */
	queue = $state<Blob[]>([]);

	/**
	 * The AudioContext instance for playing audio.
	 *
	 * @private
	 * @type {AudioContext}
	 */
	private audioContext = new AudioContext();

	/**
	 * Indicates whether the TTS is currently playing audio.
	 *
	 * This is a reactive state that updates based on the audio playback status.
	 * It is initialized to false.
	 *
	 * @public
	 * @type {boolean}
	 */
	public isPlaying = $state(false);

	/**
	 * Stores the interval ID for the play loop.
	 *
	 * @private
	 * @type {number | undefined}
	 */
	private playIntervalId: number | undefined;

	/**
	 * The listener for Twitch chat messages.
	 *
	 * This is used to handle incoming chat messages for TTS processing.
	 *
	 * @private
	 * @type {Listener | undefined}
	 */
	private chatListener: Listener | undefined;

	/**
	 * Twitch module instance.
	 * This is used to interact with Twitch services.
	 *
	 * @readonly
	 * @type {Twitch}
	 */
	readonly twitch = $derived(app.activeModules.get('twitch') as Twitch);

	/**
	 * Personal TTS module instance.
	 * This is used to handle personal TTS functionality.
	 *
	 * @readonly
	 * @type {TTSPersonal}
	 */
	public personal?: TTSPersonal;

	constructor() {
		$effect.root(() => {
			watch(
				() => this.enabled,
				() => {
					if (this.enabled) {
						this.init();
					} else {
						this.destroy();
					}
				}
			);
		});

		app.on('boot', () => this.init());
	}

	async init() {
		if (!this.enabled || !this.twitch) {
			return;
		}

		this.personal = await new TTSPersonal().init();
		this.startPlaybackLoop();

		this.chatListener = this.twitch.chatClient?.onMessage((channel, users, text, msg) =>
			this.message(channel, users, text, msg)
		);
	}

	/**
	 * Handles incoming Twitch chat messages.
	 * This method is called when a message is received in the Twitch chat.
	 *
	 * @param {string} channel - The Twitch channel where the message was sent.
	 * @param {string} user - The username of the sender.
	 * @param {string} message - The content of the message.
	 * @param {ChatMessage} msg - The ChatMessage object containing additional information.
	 *
	 * @private
	 */
	private async message(channel: string, user: string, message: string, msg: ChatMessage) {
		if (message.length < 1 && message.startsWith('!')) {
			return;
		}

		if (user.endsWith('bot') || user.startsWith('bot')) {
			return;
		}

		if (this.twitch.settings.provider === 'elevenlabs') {
			await this.elevenlabs(message, user);
		}

		if (this.twitch.settings.provider === 'brian') {
			await this.brian(message);
		}
	}

	/**
	 * Generates TTS audio using ElevenLabs API.
	 *
	 * @param message
	 * @private
	 */
	private async elevenlabs(message: string, user: string) {
		let voice_settings: VoiceSettings = {
			stability: 0.3,
			similarity_boost: 0.8,
			style: 1
		};

		const voice = this.personal?.activeVoices[user] || this.twitch.settings.voiceName;

		if (voice === 'Adolf') {
			const response = await translate(message, { to: 'de', requestFunction: fetch });
			message = response.text;
		}

		try {
			const audioStream = (await this.twitch.elevenlabs?.client?.generate({
				voice,
				text: message,
				model_id: 'eleven_multilingual_v2',
				enable_logging: false,
				output_format: 'mp3_44100_192',
				voice_settings
			})) as unknown as { reader: ReadableStreamDefaultReader<Uint8Array> };

			// Create a Blob from the audio stream
			const chunks: Uint8Array[] = [];
			const reader = audioStream.reader; // Get the reader once

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					this.queue.push(new Blob(chunks, { type: 'audio/mpeg' }));

					if (!this.isPlaying) {
						this.playNext();
					}

					/**
					 * This is a workaround to delete the history item after playback.
					 * The ElevenLabs API does not support deleting history items directly.
					 *
					 * We dont wanna keep the history items around, so we delete it right after playback.
					 */
					try {
						this.twitch.elevenlabs?.client?.history.getAll().then(({ history }) => {
							this.twitch.elevenlabs?.client?.history.delete(history[0].history_item_id);
						});
					} catch (_) {}

					break;
				}
				if (value) {
					chunks.push(value);
				}
			}
		} catch (error) {
			console.error('Error generating or processing audio stream:', error);
		}
	}

	/**
	 * Generates TTS audio using the Brian API.
	 * This method fetches audio data from the Brian API and adds it to the queue.
	 *
	 * @param message - The message to be converted to speech.
	 * @private
	 */
	private async brian(message: string) {
		if (message.includes('http://') || message.includes('https://')) {
			return;
		}

		// Causes brian to freak out
		message = message.replaceAll('%', 'percent');

		try {
			const response = await fetch(
				`https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(message)}`
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' }); // Create a Blob

			this.queue.push(audioBlob); // Add the Blob to the queue

			// Trigger playback check if not currently playing
			if (!this.isPlaying) {
				this.playNext();
			}
		} catch (error) {
			console.error('Error fetching or processing Brian TTS audio:', error);
		}
	}

	/**
	 * Starts the playback loop for the audio queue.
	 * This method uses a flag and setTimeout for better control than setInterval.
	 * It checks the queue every 250ms and plays the next audio blob if available.
	 *
	 * @private
	 * @returns {void}
	 */
	private startPlaybackLoop() {
		// Use a flag and setTimeout for better control than setInterval
		const checkQueue = async () => {
			if (!this.isPlaying && this.queue.length > 0) {
				await this.playNext();
			}
			// Check again after a short delay
			this.playIntervalId = window.setTimeout(checkQueue, 250); // Check more frequently
		};
		checkQueue(); // Start the loop
	}

	/**
	 * Plays the next audio blob in the queue.
	 * This method handles the audio playback using the Web Audio API.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async playNext() {
		if (this.isPlaying || this.queue.length === 0) {
			return; // Don't play if already playing or queue is empty
		}

		const audio = this.queue.shift();

		if (!audio) {
			return;
		}

		this.isPlaying = true; // Set playing flag immediately

		try {
			const arrayBuffer = await audio.arrayBuffer();
			// Ensure AudioContext is running (required after user interaction)
			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume();
			}
			const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

			// Create a *new* source node for each playback
			const source = this.audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(this.audioContext.destination);

			// Set isPlaying to false when this specific audio finishes
			source.onended = () => {
				this.isPlaying = false;
				// No need to explicitly call playNext here, the loop handles it
			};

			source.start(0); // Play immediately
		} catch (error) {
			console.error('Error decoding or playing audio:', error);
			this.isPlaying = false; // Reset flag on error
		}
	}

	/**
	 * Destroys the TTS module.
	 * This method clears the audio queue, stops playback, and unbinds any listeners.
	 *
	 * @public
	 * @returns {void}
	 */
	destroy(): void {
		console.log('TTS module destroyed');

		if (this.playIntervalId) {
			clearInterval(this.playIntervalId);
			this.playIntervalId = undefined;
		}

		if (this.chatListener) {
			this.chatListener.unbind();
			this.chatListener = undefined;
		}

		this.queue = [];
		this.isPlaying = false;
	}
}
