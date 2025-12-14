import type { Listener } from '@d-fischer/typed-event-emitter';
import { ApiClient } from '@twurple/api';
import { StaticAuthProvider, TokenInfo } from '@twurple/auth';
import { Feature } from '$features/feature.svelte';
import { watch } from 'runed';
import { ChatClient, ChatMessage } from '@twurple/chat';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { error } from '@tauri-apps/plugin-log';
import { app } from '$core/app/app.svelte';

export type ValidatedTokenInfo = TokenInfo & { userId: string };

export type TwitchSettings = {
	accessToken: string | null;
	clientId: string;
};

export interface TwitchEvents {
	'chat-message': { channel: string; user: string; message: string; msg: ChatMessage };
}

interface EmoteInfo {
	id: string;
	name: string;
	url: string;
	startIndex?: number;
	endIndex?: number;
}

interface BadgeImage {
	name: string;
	version: string;
	url: string;
}

interface ParsedMessage {
	channel: string;
	user: string;
	message: string;
	displayName: string;
	color: string;
	emotes: EmoteInfo[];
	badges: { [key: string]: string };
	badgeImages: BadgeImage[];
}

type ChatBadgeList = Awaited<ReturnType<ApiClient['chat']['getGlobalBadges']>>;

export class Twitch extends Feature<TwitchSettings, TwitchEvents> {
	name = 'twitch';

	client: ApiClient | null = $state(null);

	token: ValidatedTokenInfo | null = $state(null);

	chatClient: ChatClient | null = $state(null);

	eventSub: EventSubWsListener | undefined = $state(undefined);

	isConnected = $derived.by(() => this.client !== null && this.token !== null);

	isLive = $state(false);

	globalBadges: ChatBadgeList | null = null;
	channelBadges: Map<string, ChatBadgeList> = new Map();

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

					// Fetch global badges
					this.client.chat.getGlobalBadges().then((badges) => {
						this.globalBadges = badges;
					});

					this.eventSub = new EventSubWsListener({ apiClient: this.client });
					this.eventSub.start();

					this.chatClient = new ChatClient({ authProvider });
					this.chatClient.connect();

					this.chatListener = this.chatClient.onMessage((channel, user, message, msg) => {
						const parsedMessage = this.parseChatMessage(channel, user, message, msg);

						this.emit('chat-message', { channel, user, message, msg });
						app.socket?.publish('twitch.chat', parsedMessage);
					});

					this.client
						.getTokenInfo()
						.then((info) => {
							this.token = info as ValidatedTokenInfo;

							this.eventSub!.onStreamOnline(this.token!.userId, () => {
								this.isLive = true;
							});

							this.eventSub!.onStreamOffline(this.token!.userId, () => {
								this.isLive = false;
							});
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
					this.client?.users.getUserByName(userName).then((user) => {
						if (user) {
							this.client?.chat.getChannelBadges(user.id).then((badges) => {
								this.channelBadges.set(userName, badges);
							});
						}
					});
				}
			);
		});
	}

	private parseEmotes(msg: ChatMessage): EmoteInfo[] {
		const emotes: EmoteInfo[] = [];
		const emoteOffsets = msg.emoteOffsets;

		for (const [emoteId, positions] of emoteOffsets) {
			for (const position of positions) {
				// positions is an array of strings like "0-4" or "6-10"
				const [start, end] = position.split('-').map(Number);
				const emoteName = msg.text.substring(start, end + 1);

				emotes.push({
					id: emoteId,
					name: emoteName,
					url: `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/3.0`,
					startIndex: start,
					endIndex: end
				});
			}
		}

		// Sort by start index in descending order for replacement
		return emotes.sort((a, b) => b.startIndex! - a.startIndex!);
	}

	private messageToHtml(msg: ChatMessage): string {
		let emotes = this.parseEmotes(msg);
		let html = msg.text;

		// Replace emotes with img tags from end to start to preserve indices
		for (const emote of emotes) {
			const before = html.substring(0, emote.startIndex);
			const after = html.substring(emote.endIndex! + 1);
			html = `${before}<img src="${emote.url}" alt="${emote.name}" class="emote" />${after}`;
		}

		return html;
	}

	private parseChatMessage(
		channel: string,
		user: string,
		message: string,
		msg: ChatMessage
	): ParsedMessage {
		const emotes = this.parseEmotes(msg);
		const badges: { [key: string]: string } = {};
		const badgeImages: BadgeImage[] = [];

		const channelBadges = this.channelBadges.get(channel);

		// Parse badges
		for (const [badgeName, badgeVersion] of msg.userInfo.badges) {
			badges[badgeName] = badgeVersion;

			const badgeSet =
				channelBadges?.find((b) => b.id === badgeName) ||
				this.globalBadges?.find((b) => b.id === badgeName);

			const version = badgeSet?.versions.find((v) => v.id === badgeVersion);

			if (version) {
				badgeImages.push({
					name: badgeName,
					version: badgeVersion,
					url: version.getImageUrl(4)
				});
			}
		}

		return {
			channel,
			user,
			message: this.messageToHtml(msg),
			displayName: msg.userInfo.displayName,
			color: msg.userInfo.color || '#FFFFFF',
			emotes,
			badges,
			badgeImages
		};
	}

	async disable() {
		if (this.chatListener) {
			this.chatClient?.removeListener(this.chatListener);
		}

		if (this.chatClient) {
			await this.chatClient.quit();
		}

		if (this.eventSub) {
			await this.eventSub.stop();
		}

		this.client = null;
		this.token = null;
		this.chatClient = null;
		this.eventSub = undefined;
		this.isLive = false;
	}

	defaultSettings() {
		return {
			accessToken: null,
			clientId: 'kp4erttmb696osn4inqrlg6qmv5eaq'
		};
	}
}

export const twitch = new Twitch();
