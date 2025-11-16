import { ApiClient } from '@twurple/api';
import { StaticAuthProvider, TokenInfo } from '@twurple/auth';
import { Plugin } from '../plugin.svelte';
import { watch } from 'runed';
import { ChatClient, ChatMessage } from '@twurple/chat';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { error } from '@tauri-apps/plugin-log';
import type { Listener } from '@d-fischer/typed-event-emitter';

export type ValidatedTokenInfo = TokenInfo & { userId: string };

export type TwitchSettings = {
	accessToken: string | null;
	clientId: string;
};

export interface TwitchEvents {
	'chat-message': { channel: string; user: string; message: string; msg: ChatMessage };
}

export class Twitch extends Plugin<TwitchSettings, TwitchEvents> {
	name = 'twitch';

	client: ApiClient | null = $state(null);

	token: ValidatedTokenInfo | null = $state(null);

	chatClient: ChatClient | null = $state(null);

	eventSub: EventSubWsListener | undefined = $state(undefined);

	private chatListener: Listener | null = null;

	enable(): Promise<this> {
		return new Promise((resolve) => {
			watch(
				() => this.settings.accessToken,
				() => {
					if (!this.settings.accessToken) {
						this.disable();
						resolve(this);
						return;
					}

					const authProvider = new StaticAuthProvider(
						this.settings.clientId,
						this.settings.accessToken
					);

					this.client = new ApiClient({ authProvider });

					this.eventSub = new EventSubWsListener({ apiClient: this.client });
					this.eventSub.start();

					this.chatClient = new ChatClient({ authProvider });
					this.chatClient.connect();

					this.chatListener = this.chatClient.onMessage((channel, user, message, msg) => {
						this.emit('chat-message', { channel, user, message, msg });
					});

					this.client
						.getTokenInfo()
						.then((info) => {
							this.token = info as ValidatedTokenInfo;
						})
						.catch((err) => {
							error(`Failed to validate Twitch token: ${err}`);
						})
						.finally(() => {
							resolve(this);
						});
				}
			);

			watch(
				() => this.token?.userName,
				(userName, prev) => {
					if (!userName) {
						return;
					}

					if (prev) {
						this.chatClient?.part(prev);
					}

					this.chatClient?.join(userName).catch(console.error);
				}
			);
		});
	}

	async disable() {
		if (this.chatListener) {
			this.chatClient?.removeListener(this.chatListener);
		}

		this.client = null;
		this.token = null;
		this.chatClient = null;
	}

	defaultSettings() {
		return {
			accessToken: null,
			clientId: 'kp4erttmb696osn4inqrlg6qmv5eaq'
		};
	}
}

export const twitch = new Twitch();
