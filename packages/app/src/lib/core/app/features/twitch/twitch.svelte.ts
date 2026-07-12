import type { Listener } from '@d-fischer/typed-event-emitter';
import { ApiClient, type HelixPrivilegedUser } from '@twurple/api';
import { StaticAuthProvider, TokenInfo } from '@twurple/auth';
import { Feature } from '$features/feature.svelte';
import { watch } from 'runed';
import { ChatClient, ChatMessage } from '@twurple/chat';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { error } from '@tauri-apps/plugin-log';
import { app } from '$core/app/context';

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

/**
 * Twitch integration.
 *
 * Single connect/disconnect path: every token change fully disposes the
 * previous ApiClient/ChatClient/EventSub before creating new ones, so chat
 * listeners can never stack up (the cause of duplicated TTS/chat messages in
 * the previous implementation).
 */
export class Twitch extends Feature<TwitchSettings, TwitchEvents> {
	name = 'twitch';

	client: ApiClient | null = $state(null);
	token: ValidatedTokenInfo | null = $state(null);
	user: HelixPrivilegedUser | null = $state(null);
	chatClient: ChatClient | null = $state(null);
	eventSub: EventSubWsListener | undefined = $state(undefined);

	isConnected = $derived.by(() => this.client !== null && this.token !== null);
	isLive = $state(false);

	globalBadges: ChatBadgeList | null = null;
	channelBadges: Map<string, ChatBadgeList> = new Map();

	#chatListener: Listener | null = null;
	#joinedChannel: string | null = null;
	#disposeWatchers: (() => void) | null = null;
	#connectQueue: Promise<void> = Promise.resolve();

	enable(): void {
		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => this.settings.accessToken,
				(accessToken) => {
					this.#connectQueue = this.#connectQueue
						.then(async () => {
							await this.#disconnect();

							if (accessToken) {
								await this.#connect(accessToken);
							}
						})
						.catch((err) => {
							void error(`[TWITCH]: connect failed: ${err}`);
						});
				}
			);
		});
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;

		this.#connectQueue = this.#connectQueue
			.then(() => this.#disconnect())
			.catch(() => undefined);

		await this.#connectQueue;
	}

	async #connect(accessToken: string): Promise<void> {
		const authProvider = new StaticAuthProvider(this.settings.clientId, accessToken);

		const client = new ApiClient({ authProvider });

		// Validate the token first; a dead token means no clients at all.
		let token: ValidatedTokenInfo;

		try {
			token = (await client.getTokenInfo()) as ValidatedTokenInfo;
		} catch (err) {
			void error(`[TWITCH]: Failed to validate Twitch token: ${err}`);
			return;
		}

		this.client = client;
		this.token = token;

		client.users
			.getAuthenticatedUser(token.userId, true)
			.then((user) => {
				this.user = user;
			})
			.catch((err) => {
				void error(`[TWITCH]: Failed to fetch user profile: ${err}`);
			});

		client.chat
			.getGlobalBadges()
			.then((badges) => {
				this.globalBadges = badges;
			})
			.catch(() => undefined);

		// EventSub: live status tracking.
		this.eventSub = new EventSubWsListener({ apiClient: client });
		this.eventSub.start();
		this.eventSub.onStreamOnline(token.userId, () => {
			this.isLive = true;
		});
		this.eventSub.onStreamOffline(token.userId, () => {
			this.isLive = false;
		});

		// Initial live state (EventSub only reports changes).
		client.streams
			.getStreamByUserId(token.userId)
			.then((stream) => {
				this.isLive = stream !== null;
			})
			.catch(() => undefined);

		// Chat client.
		this.chatClient = new ChatClient({ authProvider });
		this.chatClient.connect();

		this.#chatListener = this.chatClient.onMessage((channel, user, message, msg) => {
			this.emit('chat-message', { channel, user, message, msg });
		});

		if (token.userName) {
			await this.#joinChannel(token.userName);
		}
	}

	async #joinChannel(userName: string): Promise<void> {
		try {
			await this.chatClient?.join(userName);
			this.#joinedChannel = userName;

			const user = await this.client?.users.getUserByName(userName);

			if (user) {
				const badges = await this.client?.chat.getChannelBadges(user.id);

				if (badges) {
					this.channelBadges.set(userName, badges);
				}
			}
		} catch (err) {
			console.error('[TWITCH]: failed to join channel:', err);
		}
	}

	async #disconnect(): Promise<void> {
		if (this.#chatListener) {
			this.chatClient?.removeListener(this.#chatListener);
			this.#chatListener = null;
		}

		if (this.#joinedChannel) {
			try {
				this.chatClient?.part(this.#joinedChannel);
			} catch {
				// ignore
			}

			this.#joinedChannel = null;
		}

		if (this.chatClient) {
			try {
				this.chatClient.quit();
			} catch {
				// ignore
			}
		}

		if (this.eventSub) {
			try {
				this.eventSub.stop();
			} catch {
				// ignore
			}
		}

		this.client = null;
		this.token = null;
		this.user = null;
		this.chatClient = null;
		this.eventSub = undefined;
		this.isLive = false;
		this.globalBadges = null;
		this.channelBadges.clear();
	}

	#parseEmotes(msg: ChatMessage): EmoteInfo[] {
		const emotes: EmoteInfo[] = [];
		const emoteOffsets = msg.emoteOffsets;

		for (const [emoteId, positions] of emoteOffsets) {
			for (const position of positions) {
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

	#messageToHtml(msg: ChatMessage): string {
		const emotes = this.#parseEmotes(msg);
		let html = msg.text;

		// Replace emotes with img tags from end to start to preserve indices
		for (const emote of emotes) {
			const before = html.substring(0, emote.startIndex);
			const after = html.substring(emote.endIndex! + 1);
			html = `${before}<img src="${emote.url}" alt="${emote.name}" class="emote" />${after}`;
		}

		return html;
	}

	parseChatMessage(
		channel: string,
		user: string,
		message: string,
		msg: ChatMessage
	): ParsedMessage {
		const emotes = this.#parseEmotes(msg);
		const badges: { [key: string]: string } = {};
		const badgeImages: BadgeImage[] = [];

		const channelBadges = this.channelBadges.get(channel);

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
			message: this.#messageToHtml(msg),
			displayName: msg.userInfo.displayName,
			color: msg.userInfo.color || '#FFFFFF',
			emotes,
			badges,
			badgeImages
		};
	}

	defaultSettings() {
		return {
			accessToken: null,
			clientId: 'kp4erttmb696osn4inqrlg6qmv5eaq'
		};
	}
}

export const twitch = new Twitch();
