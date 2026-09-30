import { cancel, onInvalidUrl, onUrl, start } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { error } from '@tauri-apps/plugin-log';
import { watch } from 'runed';
import { api } from '$core/api';
import { Feature } from '$features/feature.svelte';
import { streamChat } from '$features/streaming/chat';
import { publishProfileLink, removeProfileLink } from '$features/streaming/profile-links';
import { fetch } from '$core/http/fetch';

export type YouTubeSettings = {
	accessToken: string | null;
	refreshToken: string | null;
	/** Epoch ms when `accessToken` expires. */
	expiresAt: number | null;
};

export type YouTubeChannel = {
	id: string;
	title: string;
	customUrl: string | null;
	thumbnailUrl: string | null;
};

type TokenResponse = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
};

type LiveChatMessage = {
	id: string;
	snippet: { type: string; displayMessage?: string };
	authorDetails: {
		channelId: string;
		displayName: string;
		isChatOwner: boolean;
		isChatSponsor: boolean;
	};
};

const API_URL = 'https://www.googleapis.com/youtube/v3';
const OAUTH_PORTS = [8001, 8002, 8003, 8004, 8005];
const LIVE_POLL_MS = 60_000;
/** Every poll spends Data API quota shared by all users of the OAuth client. */
const CHAT_MIN_POLL_MS = 10_000;
const TOKEN_SKEW_MS = 60_000;

function base64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/**
 * YouTube Live integration: OAuth via the website (client secret stays server-side),
 * live status of the connected channel, and live chat in/out via the YouTube Data API.
 */
export class YouTube extends Feature<YouTubeSettings> {
	name = 'youtube';

	readonly platform = 'youtube' as const;

	channel: YouTubeChannel | null = $state(null);
	isLive = $state(false);
	liveChatId: string | null = $state(null);
	isConnecting = $state(false);

	isConnected = $derived.by(() => this.channel !== null);

	get canSay(): boolean {
		return this.isConnected && this.isLive && this.liveChatId !== null;
	}

	get channelUrl(): string | null {
		if (!this.channel) {
			return null;
		}

		return this.channel.customUrl
			? `https://www.youtube.com/${this.channel.customUrl}`
			: `https://www.youtube.com/channel/${this.channel.id}`;
	}

	#disposeWatchers: (() => void) | null = null;
	#liveTimer: ReturnType<typeof setInterval> | null = null;
	#chatTimer: ReturnType<typeof setTimeout> | null = null;
	#chatPageToken: string | null = null;
	#sentMessageIds = new Set<string>();
	#generation = 0;

	enable(): void {
		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => this.settings.refreshToken,
				(refreshToken) => {
					this.#stop();
					if (refreshToken) {
						void this.#start();
					}
				}
			);
		});
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;
		this.#stop();
	}

	/**
	 * Opens Google consent through the website, then redeems a short-lived handoff
	 * code for tokens stored only on this device.
	 */
	async connect(): Promise<boolean> {
		this.isConnecting = true;
		const unlisten: Array<() => void> = [];
		let port: number | null = null;
		try {
			const state = base64Url(crypto.getRandomValues(new Uint8Array(12)));
			port = await start({ ports: OAUTH_PORTS });
			const redirectUri = `http://localhost:${port}`;

			const code = await new Promise<string | null>((resolve) => {
				void onUrl((raw) => {
					const params = new URL(raw).searchParams;
					if (params.get('state') !== state) {
						resolve(null);
						return;
					}

					if (params.get('error')) {
						resolve(null);
						return;
					}

					resolve(params.get('code'));
				}).then((off) => unlisten.push(off));
				void onInvalidUrl(() => resolve(null)).then((off) => unlisten.push(off));
				void openUrl(api.streaming.youtubeStartUrl(redirectUri, state));
			});

			if (!code) {
				return false;
			}

			const redeemed = await api.streaming.redeemYoutube(code);
			if (redeemed.isErr()) {
				void error(`[YOUTUBE]: redeem failed: ${redeemed.error.message}`);
				return false;
			}

			this.#storeToken(redeemed.value);
			return true;
		} finally {
			unlisten.forEach((off) => off());
			if (port !== null) {
				void cancel(port);
			}

			this.isConnecting = false;
		}
	}

	disconnect() {
		this.settings.accessToken = null;
		this.settings.refreshToken = null;
		this.settings.expiresAt = null;
		void removeProfileLink('youtube');
	}

	async say(text: string): Promise<void> {
		if (!this.canSay) {
			return;
		}

		try {
			const message = await this.#api<{ id: string }>('liveChat/messages?part=snippet', {
				method: 'POST',
				body: JSON.stringify({
					snippet: {
						liveChatId: this.liveChatId,
						type: 'textMessageEvent',
						textMessageDetails: { messageText: text.slice(0, 200) }
					}
				})
			});
			this.#sentMessageIds.add(message.id);
		} catch (err) {
			void error(`[YOUTUBE]: failed to send chat message: ${err}`);
		}
	}

	async #start() {
		const generation = ++this.#generation;
		try {
			const data = await this.#api<{
				items?: Array<{
					id: string;
					snippet: {
						title: string;
						customUrl?: string;
						thumbnails?: { default?: { url: string } };
					};
				}>;
			}>('channels?part=snippet&mine=true');
			const item = data.items?.[0];
			if (generation !== this.#generation || !item) {
				return;
			}

			this.channel = {
				id: item.id,
				title: item.snippet.title,
				customUrl: item.snippet.customUrl ?? null,
				thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null
			};
			if (this.channelUrl) {
				void publishProfileLink('youtube', this.channelUrl);
			}
		} catch (err) {
			void error(`[YOUTUBE]: failed to load channel: ${err}`);
			return;
		}

		await this.#refreshLive(generation);
		this.#liveTimer = setInterval(() => void this.#refreshLive(generation), LIVE_POLL_MS);
	}

	#stop() {
		this.#generation++;
		if (this.#liveTimer) {
			clearInterval(this.#liveTimer);
			this.#liveTimer = null;
		}

		this.#stopChat();
		this.channel = null;
		this.isLive = false;
	}

	#stopChat() {
		if (this.#chatTimer) {
			clearTimeout(this.#chatTimer);
			this.#chatTimer = null;
		}

		this.liveChatId = null;
		this.#chatPageToken = null;
		this.#sentMessageIds.clear();
	}

	async #refreshLive(generation: number) {
		try {
			const data = await this.#api<{
				items?: Array<{ snippet: { liveChatId?: string } }>;
			}>('liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all&maxResults=1');
			if (generation !== this.#generation) {
				return;
			}

			const liveChatId = data.items?.[0]?.snippet.liveChatId ?? null;
			this.isLive = Boolean(data.items?.length);
			if (liveChatId === this.liveChatId) {
				return;
			}

			this.#stopChat();
			if (liveChatId) {
				this.liveChatId = liveChatId;
				void this.#pollChat(generation, liveChatId, true);
			}
		} catch (err) {
			void error(`[YOUTUBE]: failed to check live status: ${err}`);
		}
	}

	async #pollChat(generation: number, liveChatId: string, skipBacklog: boolean) {
		let delay = CHAT_MIN_POLL_MS;
		try {
			const params = new URLSearchParams({ liveChatId, part: 'snippet,authorDetails' });
			if (this.#chatPageToken) {
				params.set('pageToken', this.#chatPageToken);
			}

			const data = await this.#api<{
				items?: LiveChatMessage[];
				nextPageToken?: string;
				pollingIntervalMillis?: number;
			}>(`liveChat/messages?${params}`);
			if (generation !== this.#generation || this.liveChatId !== liveChatId) {
				return;
			}

			this.#chatPageToken = data.nextPageToken ?? null;
			delay = Math.max(CHAT_MIN_POLL_MS, data.pollingIntervalMillis ?? 0);

			if (!skipBacklog) {
				for (const item of data.items ?? []) {
					this.#emitMessage(item);
				}
			}
		} catch (err) {
			void error(`[YOUTUBE]: failed to poll chat: ${err}`);
			delay = CHAT_MIN_POLL_MS * 3;
		}

		if (generation !== this.#generation || this.liveChatId !== liveChatId) {
			return;
		}

		this.#chatTimer = setTimeout(() => void this.#pollChat(generation, liveChatId, false), delay);
	}

	#emitMessage(item: LiveChatMessage) {
		if (this.#sentMessageIds.delete(item.id)) {
			return;
		}

		const message = item.snippet.displayMessage?.trim();
		if (item.snippet.type !== 'textMessageEvent' || !message) {
			return;
		}

		void streamChat.emit('message', {
			platform: 'youtube',
			user: item.authorDetails.channelId,
			displayName: item.authorDetails.displayName.replace(/^@/, ''),
			message,
			isSubscriber: item.authorDetails.isChatSponsor || item.authorDetails.isChatOwner
		});
	}

	async #accessToken(): Promise<string> {
		const { accessToken, expiresAt, refreshToken } = this.settings;
		if (accessToken && expiresAt && Date.now() < expiresAt - TOKEN_SKEW_MS) {
			return accessToken;
		}

		if (!refreshToken) {
			throw new Error('YouTube is not connected.');
		}

		const refreshed = await api.streaming.refreshYoutube(refreshToken);
		if (refreshed.isErr()) {
			throw new Error(refreshed.error.message);
		}

		this.#storeToken(refreshed.value);
		return refreshed.value.access_token;
	}

	#storeToken(token: TokenResponse) {
		this.settings.accessToken = token.access_token;
		this.settings.expiresAt = Date.now() + token.expires_in * 1000;
		if (token.refresh_token) {
			this.settings.refreshToken = token.refresh_token;
		}
	}

	async #api<T>(path: string, init: RequestInit = {}): Promise<T> {
		const token = await this.#accessToken();
		const response = await fetch(`${API_URL}/${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				...init.headers
			}
		});
		if (!response.ok) {
			throw new Error(`${path.split('?')[0]} failed (${response.status})`);
		}

		return (await response.json()) as T;
	}

	defaultSettings(): YouTubeSettings {
		return {
			accessToken: null,
			refreshToken: null,
			expiresAt: null
		};
	}
}

export const youtube = new YouTube();

streamChat.registerSink(youtube);
