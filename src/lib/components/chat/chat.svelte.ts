import type { ChatMessageExpanded } from '$core/app/database/chat-rooms';
import type { UsersResponse } from '$core/pocketbase/types';
import { app } from '$core/context';
import { Context } from 'runed';
import NotificationSound from '$lib/files/notification-message.mp3?url';
import type { UnsubscribeFunction } from 'emittery';

export type MessageAttachment = {
	type: 'image' | 'file';
	file: File | Blob;
};

export type ChatComposeContext = {
	attachments: MessageAttachment[];
	message: string;
};

export type ChatContext = {
	id: string;
	members?: UsersResponse[];
	messages?: ChatMessageExpanded[];
};

const chatContext = new Context<Chat>('<chat />');
export const createChat = (id: string) => chatContext.set(new Chat(id));
export const useChat = () => chatContext.get();

const chatComposeContext = new Context<ChatCompose>('<chat-compose />');
export const createChatCompose = () => chatComposeContext.set(new ChatCompose());
export const useChatCompose = () => chatComposeContext.get();

export class Chat {
	#isJoining = $state<boolean>(false);

	#messages = $state<ChatMessageExpanded[]>([]);

	#members = $state<UsersResponse[]>([]);

	#notificationAudio?: HTMLAudioElement;

	#createHandler?: UnsubscribeFunction;
	#updateHandler?: UnsubscribeFunction;
	#deleteHandler?: UnsubscribeFunction;

	constructor(public id: string) {}

	async join() {
		app.database.chatRooms.getOne(this.id).then((chat) => {
			this.#isJoining = false;
			this.#members = chat.members;
			this.#messages = chat.messages.items;
		});

		app.database.chatRooms.subscribeToRoom(this.id);

		this.#createHandler = app.database.chatRooms.on('create', (message) => {
			this.#messages.push(message);

			if (
				message.sender.id !== app.features.auth.userId &&
				false === app.features.chat.settings.muted
			) {
				if (!this.#notificationAudio) {
					this.#notificationAudio = new Audio(NotificationSound);
				}

				this.#notificationAudio.currentTime = 0;
				this.#notificationAudio.play().catch(() => {});
			}
		});

		this.#updateHandler = app.database.chatRooms.on('update', (message) => {
			const index = this.#messages.findIndex((m) => m.id === message.id);

			if (index !== -1) {
				this.#messages[index] = message;
			}
		});

		this.#deleteHandler = app.database.chatRooms.on('delete', (message) => {
			this.#messages = this.#messages.filter((m) => m.id !== message.id);
		});
	}

	async leave() {
		this.#isJoining = false;
		this.#members = [];
		this.#messages = [];
		this.#notificationAudio = undefined;

		this.#createHandler?.();
		this.#updateHandler?.();
		this.#deleteHandler?.();

		app.database.chatRooms.unsubscribeFromRoom(this.id);
	}

	async sendMessage(message: string | undefined, attachments: MessageAttachment[]) {
		return app.database.chatRooms.createMessage(this.id, message, attachments);
	}

	async editMessage(messageId: string, message: string) {
		return app.database.chatRooms.editMessage(messageId, message);
	}

	capture() {
		app.database.chatRooms.unsubscribeFromRoom(this.id);

		return {
			id: this.id,
			messages: this.messages,
			members: this.members
		};
	}

	restore(context: ChatContext) {
		this.id = context.id;
		this.#messages = context.messages!;
		this.#members = context.members!;
	}

	get isJoining() {
		return this.#isJoining;
	}

	get messages() {
		return this.#messages;
	}

	get members() {
		return this.#members;
	}
}

export class ChatCompose {
	id = $state<string>();
	isSending = $state<boolean>(false);
	attachments = $state<MessageAttachment[]>([]);
	message = $state<string>();
	error = $state<string | null>(null);

	editMessage(messageId: string, message: string) {
		this.id = messageId;
		this.message = message;
	}

	reset() {
		this.id = undefined;
		this.attachments = [];
		this.message = undefined;
		this.isSending = false;
		this.error = null;
	}
}
