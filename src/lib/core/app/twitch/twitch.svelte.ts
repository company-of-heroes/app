import { Module } from '$lib/modules/module.svelte';
import { ApiClient } from '@twurple/api';
import { app } from '../app.svelte';
import { StaticAuthProvider, TokenInfo } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { TTS } from './tts.svelte';

export class Twitch extends Module {
	enabled = $derived(app.settings.twitch.enabled && app.settings.twitch.accessToken !== null);

	/**
	 * The token information retrieved from Twitch.
	 *
	 * @public
	 * @type {TokenInfo | undefined}
	 */
	public tokenInfo: TokenInfo | undefined = $state(undefined);

	/**
	 * The Twurple API client instance.
	 * Undefined until initialized.
	 *
	 * @public
	 * @type {ApiClient | undefined}
	 */
	public client: ApiClient | undefined = $state(undefined);

	/**
	 * The Twurple ChatClient instance.
	 *
	 * @public
	 * @type {ChatClient | undefined}
	 */
	public chatClient: ChatClient | undefined = $state(undefined);

	/**
	 * Personal TTS module instance.
	 *
	 * @public
	 * @type {TTS | undefined}
	 */
	public tts: TTS | undefined = $state(undefined);

	async init() {
		const authProvider = new StaticAuthProvider(
			app.settings.twitch.clientId,
			app.settings.twitch.accessToken!
		);
		this.client = new ApiClient({ authProvider });
		this.tokenInfo = await this.client.getTokenInfo();

		this.chatClient = new ChatClient({
			authProvider,
			channels: [this.tokenInfo.userName!] // ['summit1g']
		});
		await this.chatClient.connect();

		this.tts = await new TTS().register();

		this.isInitialized = true;
	}

	destroy() {
		this.isInitialized = false;
		this.client = undefined;
		this.tokenInfo = undefined;
	}
}
