import Emittery from 'emittery';

export type StreamPlatform = 'twitch' | 'youtube';

export type StreamChatMessage = {
	platform: StreamPlatform;
	/** Stable per-platform user key (Twitch login, YouTube channel id). */
	user: string;
	displayName: string;
	message: string;
	isSubscriber: boolean;
};

export interface StreamChatSink {
	readonly platform: StreamPlatform;
	/** Connected, live, and able to post into the current chat. */
	readonly canSay: boolean;
	say(text: string): Promise<void>;
}

type StreamChatEvents = {
	message: StreamChatMessage;
};

/** Platform-agnostic live chat: Twitch and YouTube publish here; TTS and the bot consume it. */
class StreamChat extends Emittery<StreamChatEvents> {
	#sinks = new Map<StreamPlatform, StreamChatSink>();

	registerSink(sink: StreamChatSink) {
		this.#sinks.set(sink.platform, sink);
	}

	get liveSinks(): StreamChatSink[] {
		return [...this.#sinks.values()].filter((sink) => sink.canSay);
	}

	/** Posts to every platform that is connected and live. */
	async sayToLive(text: string): Promise<void> {
		await Promise.allSettled(this.liveSinks.map((sink) => sink.say(text)));
	}
}

export const streamChat = new StreamChat();
