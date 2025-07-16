import { app } from '$core/app';
import { StaticAuthProvider, TokenInfo } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { Module } from '../module.svelte';
import TwitchView from './twitch-view.svelte';
import { ElevenLabs } from './elevenlabs.svelte';
import { TTS } from './tts.svelte';
import { merge } from 'lodash-es';
import { Preditctions } from './predictions.svelte';

export type TwitchSettings = {
	enabled: boolean;
	elevenlabsApiKey: string | undefined;
	channel: string | undefined;
	accessToken: string | undefined;
	provider: 'elevenlabs' | 'brian';
	voiceName: string;
	personalVoicesEnabled: boolean;
	personalVoices: string[];
	predictionsEnabled: boolean;
	predictionsTitle: string;
	predictionsOptions: string[];
};

export const defaultTwitchSettings: TwitchSettings = {
	enabled: false,
	channel: undefined,
	elevenlabsApiKey: undefined,
	accessToken: undefined,
	provider: 'brian',
	voiceName: 'Roger',
	personalVoicesEnabled: false,
	personalVoices: [],
	predictionsEnabled: false,
	predictionsTitle: 'Lose or Win',
	predictionsOptions: ['Win', 'Lose']
};

/**
 * Represents the Twitch integration module.
 * Handles authentication and interaction with the Twitch API.
 */
export class Twitch extends Module {
	isInitialized?: boolean | undefined;

	/**
	 * Indicates whether the module is intended for streamers.
	 * This is used to determine if the module should be loaded.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	readonly isForStreamer = true;

	/**
	 * The name of the module as it appears in the menu.
	 * This is used for internal identification and should be unique.
	 *
	 * @readonly
	 * @type {string}
	 */
	readonly name = 'twitch';

	/**
	 * The name of the module as it appears in the menu.
	 *
	 * @readonly
	 * @type {string}
	 */
	readonly menuItemName = 'Twitch';

	/**
	 * The component for the module.
	 * This is used to render the module's UI.
	 *
	 * @readonly
	 * @type {import('svelte').Component}
	 */
	readonly component = TwitchView;

	/**
	 * The client ID for the Twitch application.
	 *
	 * @readonly
	 * @type {string}
	 */
	readonly clientId = 'kp4erttmb696osn4inqrlg6qmv5eaq';

	/**
	 * Twitch module settings.
	 * These are configurable in the UI and persist on disk.
	 *
	 * @readonly
	 * @type {TwitchSettings}
	 */
	readonly settings: TwitchSettings = $derived(app.settings.twitch ?? defaultTwitchSettings);

	/**
	 * The Twurple API client instance.
	 * Undefined until initialized.
	 *
	 * @public
	 * @type {ApiClient | undefined}
	 */
	public client: ApiClient | undefined = $state(undefined);

	/**
	 * The user information retrieved from the Twitch API.
	 *
	 * @public
	 * @type {TokenInfo | undefined}
	 */
	public user: TokenInfo | undefined = $state(undefined);

	/**
	 * The Twurple ChatClient instance.
	 *
	 * @public
	 * @type {ChatClient | undefined}
	 */
	public chatClient: ChatClient | undefined = $state(undefined);

	/**
	 * The EventSub WebSocket listener instance.
	 *
	 * @public
	 * @type {EventSubWsListener | undefined}
	 */
	public eventSub: EventSubWsListener | undefined = $state(undefined);

	/**
	 * ElevenLabs client instance for TTS functionality.
	 *
	 * @public
	 * @type {ElevenLabsClient | undefined}
	 */
	public elevenlabs: ElevenLabs | undefined = $state(undefined);

	/**
	 * Indicates whether the Twitch module is enabled.
	 * This is derived from the application settings.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	readonly enabled = $derived(!!this.settings.accessToken);

	/**
	 * Indicates whether the Twitch client is connected.
	 *
	 * @public
	 * @type {boolean}
	 */
	public isConnected = $derived(this.enabled);

	/**
	 * The TTS (Text-to-Speech) instance for handling voice synthesis.
	 *
	 * @public
	 * @type {TTS | undefined}
	 */
	public tts: TTS | undefined = $state(undefined);

	/**
	 * The Predictions module instance for handling Twitch predictions.
	 * This is initialized when the Twitch module is booted.
	 *
	 * @public
	 * @type {Preditctions | undefined}
	 */
	public predictions: Preditctions | undefined = $state(undefined);

	/**
	 * Initializes the Twurple ApiClient with the provided credentials.
	 * Logs an error if the access token is missing.
	 */
	async init() {
		try {
			const authProvider = new StaticAuthProvider(this.clientId, this.settings.accessToken!);

			this.client = new ApiClient({ authProvider });
			this.user = (await this.client.getTokenInfo()) ?? undefined;

			this.chatClient = new ChatClient({
				authProvider,
				channels: [this.user.userName!] // ['summit1g']
			});
			this.eventSub = new EventSubWsListener({ apiClient: this.client });

			this.eventSub.start();
			this.chatClient.connect();

			app.on('boot', () => {
				this.elevenlabs = new ElevenLabs();
				this.tts = new TTS();
				this.predictions = new Preditctions();
			});
		} catch (error) {
			this.disconnect();
			console.error('Failed to initialize Twitch client:', error);
		}
	}

	async disconnect() {
		await this.chatClient?.quit();

		this.settings.accessToken = undefined;
		this.client = undefined;
		this.chatClient = undefined;
		this.user = undefined;
		this.isConnected = false;
	}

	destroy() {
		this.disconnect();
	}
}
