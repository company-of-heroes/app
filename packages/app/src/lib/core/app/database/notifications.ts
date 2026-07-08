import type {
	Create,
	NotificationReadsResponse,
	NotificationsResponse
} from '$core/pocketbase/types';
import type { RecordSubscription, UnsubscribeFunc } from 'pocketbase';
import { pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { account } from '$core/account';

export type NotificationRecord = NotificationsResponse;
export type NotificationReadRecord = NotificationReadsResponse;

export type NotificationCreateInput = {
	title: string;
	body: string;
	targetAll: boolean;
	recipients?: string[];
};

const USER_FILTER = (userId: string) =>
	`(targetAll = true || recipients.id ?= "${userId}")`;

const UNREAD_SCAN_LIMIT = 50;

/**
 * Notifications repository: broadcast/ targeted messages and per-user read state.
 */
export class Notifications {
	async listForUser(userId: string, limit = 10): Promise<NotificationRecord[]> {
		const response = await pocketbase.collection('notifications').getList<NotificationRecord>(1, limit, {
			filter: USER_FILTER(userId),
			sort: '-created',
			fetch
		});

		return response.items;
	}

	async listAll(limit = 50): Promise<NotificationRecord[]> {
		const response = await pocketbase.collection('notifications').getList<NotificationRecord>(1, limit, {
			sort: '-created',
			fetch
		});

		return response.items;
	}

	async getReadIds(userId: string): Promise<Set<string>> {
		const reads = await pocketbase.collection('notification_reads').getFullList<NotificationReadRecord>({
			filter: `user = "${userId}"`,
			fields: 'notification',
			fetch
		});

		return new Set(reads.map((read) => read.notification));
	}

	async countUnread(userId: string): Promise<number> {
		const [notifications, readIds] = await Promise.all([
			pocketbase.collection('notifications').getList<NotificationRecord>(1, UNREAD_SCAN_LIMIT, {
				filter: USER_FILTER(userId),
				sort: '-created',
				fields: 'id',
				fetch
			}),
			this.getReadIds(userId)
		]);

		return notifications.items.filter((notification) => !readIds.has(notification.id)).length;
	}

	async create(input: NotificationCreateInput): Promise<NotificationRecord> {
		const data: Create<'notifications'> = {
			title: input.title,
			body: input.body,
			targetAll: input.targetAll,
			recipients: input.targetAll ? [] : input.recipients,
			createdBy: pocketbase.authStore.record?.id ?? account.userId
		};

		return pocketbase.collection('notifications').create(data, { fetch });
	}

	async markAsRead(userId: string, notificationId: string): Promise<NotificationReadRecord> {
		try {
			return await pocketbase.collection('notification_reads').getFirstListItem<NotificationReadRecord>(
				`user = "${userId}" && notification = "${notificationId}"`,
				{ fetch }
			);
		} catch {
			const data: Create<'notification_reads'> = {
				user: userId,
				notification: notificationId
			};

			return pocketbase.collection('notification_reads').create(data, { fetch });
		}
	}

	subscribe(callback: (event: RecordSubscription<NotificationRecord>) => void): Promise<UnsubscribeFunc> {
		return pocketbase.collection('notifications').subscribe('*', callback, { fetch });
	}

	subscribeReads(
		userId: string,
		callback: (event: RecordSubscription<NotificationReadRecord>) => void
	): Promise<UnsubscribeFunc> {
		return pocketbase.collection('notification_reads').subscribe('*', (event) => {
			if (event.record.user === userId) {
				callback(event);
			}
		}, { fetch });
	}

	appliesToUser(notification: NotificationRecord, userId: string): boolean {
		if (notification.targetAll) {
			return true;
		}

		return notification.recipients?.includes(userId) ?? false;
	}
}
