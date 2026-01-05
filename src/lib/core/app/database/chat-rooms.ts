import type {
	AttachmentsResponse,
	ChatMessagesResponse,
	ChatRoomsResponse,
	UsersResponse
} from '$core/pocketbase/types';
import type { Expand } from '@fknoobs/app';
import { fetch } from '@tauri-apps/plugin-http';
import { exp } from '$core/pocketbase';
import type { ListResult, UnsubscribeFunc } from 'pocketbase';
import Emittery from 'emittery';
import type { MessageAttachment } from '$lib/components/chat';
import { app } from '$core/context';

export type ChatRoom = ChatRoomsResponse<{
	members: UsersResponse[];
}>;
export type ChatRoomExpanded = Expand<ChatRoom>;
export type ChatMessage = ChatMessagesResponse<{
	attachments: AttachmentsResponse[];
	sender: UsersResponse<Record<string, any>, string[]>;
}>;
export type ChatMessageExpanded = Expand<ChatMessage>;

const DEFAULT_CHAT_ROOM_EXPAND = 'members';
const DEFAULT_CHAT_MESSAGE_EXPAND = 'attachments,sender';

export type ChatRoomEvents = {
	create: ChatMessageExpanded;
	update: ChatMessageExpanded;
	delete: ChatMessageExpanded;
};

export class ChatRooms extends Emittery<ChatRoomEvents> {
	subscriptions: Map<string, UnsubscribeFunc> = new Map();

	async getOne(
		id: string
	): Promise<ChatRoomExpanded & { messages: ListResult<ChatMessageExpanded> }> {
		return app.pocketbase
			.collection('chat_rooms')
			.getOne<ChatRoom>(id, { expand: DEFAULT_CHAT_ROOM_EXPAND })
			.then(async (room) => {
				return {
					room,
					messages: await this.getMessages(room.id)
				};
			})
			.then(({ room, messages }) => {
				return {
					...exp(room),
					messages
				};
			});
	}

	async getMessages(
		roomId: string,
		page: number = 1,
		perPage: number = 50
	): Promise<ListResult<ChatMessageExpanded>> {
		return app.pocketbase
			.collection('chat_messages')
			.getList<ChatMessage>(page, perPage, {
				filter: `chatRoom = "${roomId}"`,
				sort: '+created',
				expand: DEFAULT_CHAT_MESSAGE_EXPAND
			})
			.then((result) => {
				return {
					...result,
					items: result.items.map(exp)
				};
			});
	}

	async createMessage(
		roomId: string,
		message: string | undefined,
		attachments: MessageAttachment[]
	): Promise<void | ChatMessagesResponse<unknown>> {
		let attPromises = await Promise.all(
			attachments.map((att) => {
				return app.pocketbase.collection('attachments').create(
					{
						type: att.type,
						file: att.file
					},
					{ fetch }
				);
			})
		);
		let atts = attPromises.map((att) => att.id);

		return app.pocketbase
			.collection('chat_messages')
			.create({
				chatRoom: roomId,
				sender: app.features.auth.userId,
				text: message,
				attachments: atts
			})
			.catch(console.error);
	}

	async editMessage(
		messageId: string,
		message: string
	): Promise<void | ChatMessagesResponse<unknown>> {
		return app.pocketbase
			.collection('chat_messages')
			.update(messageId, {
				text: message
			})
			.catch(console.error);
	}

	async deleteMessage(messageId: string): Promise<boolean | void> {
		return app.pocketbase.collection('chat_messages').delete(messageId).catch(console.error);
	}

	async subscribeToRoom(roomId: string): Promise<void> {
		this.subscriptions.set(
			roomId,
			await app.pocketbase.collection<ChatMessage>('chat_messages').subscribe<ChatMessage>(
				'*',
				(e) => {
					if (e.record.chatRoom !== roomId) {
						return;
					}

					if (e.action === 'create') {
						return this.emit('create', exp(e.record));
					}

					if (e.action === 'update') {
						return this.emit('update', exp(e.record));
					}

					if (e.action === 'delete') {
						return this.emit('delete', exp(e.record));
					}
				},
				{
					filter: `chatRoom = "${roomId}"`,
					expand: DEFAULT_CHAT_MESSAGE_EXPAND
				}
			)
		);
	}

	async unsubscribeFromRoom(roomId: string): Promise<void> {
		const unsubscribe = this.subscriptions.get(roomId);

		if (unsubscribe) {
			await unsubscribe();
			this.subscriptions.delete(roomId);
		}
	}

	async join(roomId: string): Promise<ChatRoomsResponse<unknown>> {
		return app.pocketbase.collection('chat_rooms').update(roomId, {
			'members+': app.features.auth.userId
		});
	}
}
