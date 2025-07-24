import type { ChatMessage } from '@twurple/chat';
import type { Listener } from '@d-fischer/typed-event-emitter';
import type { VoiceSettings } from '@elevenlabs/elevenlabs-js/api';
import type { Twitch } from './twitch.svelte';
import { app } from '$core/app';
import { translate } from 'google-translate-api-x';
import { fetch } from '@tauri-apps/plugin-http';
import { TTSPersonal } from './tts-personal.svelte';
import { Bootable } from '../bootable.svelte';

/**
 * Represents the Text-to-Speech (TTS) module.
 * Handles TTS initialization and potentially interaction with TTS services.
 */
export class TTS extends Bootable {
	/**
	 * Indicates whether the TTS module is enabled.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	enabled = $derived(
		!!app.settings.twitch?.enabled &&
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
	public personal: TTSPersonal = new TTSPersonal();

	/**
	 * The last user who sent a message.
	 * This is used to track the last user for TTS purposes.
	 *
	 * @private
	 * @type {string | null}
	 */
	private lastMessageUser: string | null = null;

	/**
	 * Timeout for the last message user.
	 * This is used to reset the last message user after a certain period.
	 *
	 * @private
	 * @type {NodeJS.Timeout | null}
	 */
	private lastMessageUserTimeout: NodeJS.Timeout | null = null;

	/**
	 * Initializes the TTS module.
	 * This method sets up the necessary listeners and starts the playback loop.
	 *
	 * @public
	 * @returns {Promise<void>}
	 */
	async init() {
		if (!this.enabled || !this.twitch) {
			return;
		}

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
		if (message.length < 1 || message.startsWith('!') || user.includes('bot')) {
			return;
		}

		// Clear existing timeout
		if (this.lastMessageUserTimeout) {
			clearTimeout(this.lastMessageUserTimeout);
		}

		// Format message if new user or use default format
		const shouldFormatMessage = user !== this.lastMessageUser;
		if (shouldFormatMessage) {
			const format = this.twitch.settings.ttsMessageFormat || '{user} said, {message}';
			message = format.replace(/\{(username|user)\}/g, user).replace(/\{(message|msg)\}/g, message);
		}

		console.log(message);

		// Generate TTS based on provider
		const provider = this.twitch.settings.provider;
		if (provider === 'elevenlabs') await this.elevenlabs(message, user);
		if (provider === 'brian') await this.brian(message);

		// Update last user and set timeout
		this.lastMessageUser = user;
		this.lastMessageUserTimeout = setTimeout(() => (this.lastMessageUser = null), 15000);
	}

	/**
	 * Generates TTS audio using ElevenLabs API.
	 *
	 * @param message
	 * @private
	 */
	private async elevenlabs(message: string, user: string) {
		let voiceSettings: VoiceSettings = {
			stability: 0.3,
			similarityBoost: 1,
			style: 0.6,
			speed: 1,
			useSpeakerBoost: true
		};

		const voice = this.personal?.activeVoices[user] || this.twitch.settings.voiceName;
		const voicesResponse = await this.twitch.elevenlabs?.client?.voices.getAll();
		const voiceId =
			voicesResponse?.voices?.find((v) => v.name === `[PERSONALITY] ${voice}`)?.voiceId ||
			voicesResponse?.voices?.find((v) => v.name === 'George')?.voiceId;

		if (!voiceId) {
			console.error('No valid voice found. Cannot proceed with TTS.');
			return;
		}

		if (voice === 'Adolf') {
			voiceSettings = {
				stability: 0.6,
				similarityBoost: 1,
				style: 0.3,
				speed: 0.9,
				useSpeakerBoost: true
			};

			try {
				const response = await translate(message, {
					to: 'de',
					requestFunction: fetch,
					requestOptions: { method: 'GET' }
				});
				message = response.text;
			} catch (error) {
				console.error('Error translating message to German:', error);
			}
		}

		if (voice === 'Simply') {
			try {
				const words = message.split(' ');
				const wordsToTranslate = words.filter((word) => word.length === 2);

				if (wordsToTranslate.length > 0) {
					// Join words to translate with newlines to get individual translations
					const textToTranslate = wordsToTranslate.join('\n');
					const response = await translate(textToTranslate, {
						to: 'de',
						requestFunction: fetch,
						requestOptions: { method: 'GET' }
					});

					const translatedWords = response.text.split('\n');
					const translationMap = new Map();

					wordsToTranslate.forEach((word, index) => {
						if (translatedWords[index]) {
							translationMap.set(word, translatedWords[index]);
						}
					});

					// Replace the original words with their translations
					message = words.map((word) => translationMap.get(word) || word).join(' ');
				}
			} catch (error) {
				console.error('Error translating words to German for Simply voice:', error);
			}
		}

		try {
			const audioStream = (await this.twitch.elevenlabs?.client?.textToSpeech.stream(voiceId, {
				text: message,
				modelId: 'eleven_multilingual_v2',
				enableLogging: false,
				outputFormat: 'mp3_44100_192',
				voiceSettings
			})) as unknown as ReadableStream;
			// Create a Blob from the audio stream
			const chunks: Uint8Array[] = [];
			const reader = audioStream.getReader();

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
						this.twitch.elevenlabs?.client?.history.list().then(({ history }) => {
							this.twitch.elevenlabs?.client?.history.delete(history[0].historyItemId);
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
			const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

			this.queue.push(audioBlob);

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
