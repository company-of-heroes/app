import type { RecordModel, RecordSubscription, UnsubscribeFunc } from 'pocketbase';
import { errAsync, ResultAsync } from 'neverthrow';
import type { ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import { fromPbPromise, pbOptions, requireAuth } from '../pb';

export type NotificationRecord = RecordModel & {
	title: string;
	body: string;
	targetAll?: boolean;
	recipients?: string[];
	createdBy?: string;
	lobby?: string;
	comment?: string;
	replay?: string;
	replayComment?: string;
};

export type NotificationReadRecord = RecordModel & {
	user: string;
	notification: string;
};

export type NotificationCreateInput = {
	title: string;
	body: string;
	targetAll: boolean;
	recipients?: string[];
};

const USER_FILTER = (userId: string) => `(targetAll = true || recipients.id ?= "${userId}")`;
const UNREAD_SCAN_LIMIT = 50;

export class NotificationsApi {
	constructor(private deps: ApiDeps) {}

	listForUser(userId: string, limit = 10): ResultAsync<NotificationRecord[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('notifications').getList<NotificationRecord>(1, limit, pbOptions(this.deps, {
				filter: USER_FILTER(userId),
				sort: '-created'
			})),
			'Failed to load notifications.'
		).map((response) => response.items);
	}

	listAll(limit = 50): ResultAsync<NotificationRecord[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('notifications').getList<NotificationRecord>(1, limit, pbOptions(this.deps, {
				sort: '-created'
			})),
			'Failed to load notifications.'
		).map((response) => response.items);
	}

	getReadIds(userId: string): ResultAsync<Set<string>, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('notification_reads')
				.getFullList<NotificationReadRecord>(
					pbOptions(this.deps, {
						filter: `user = "${userId}"`,
						fields: 'notification'
					})
				),
			'Failed to load notification reads.'
		).map((reads) => new Set(reads.map((read) => String(read.notification))));
	}

	countUnread(userId: string): ResultAsync<number, ApiError> {
		return ResultAsync.combine([
			fromPbPromise(
				this.deps.pocketbase
					.collection('notifications')
					.getList<NotificationRecord>(1, UNREAD_SCAN_LIMIT, pbOptions(this.deps, {
						filter: USER_FILTER(userId),
						sort: '-created',
						fields: 'id'
					})),
				'Failed to load notifications.'
			),
			this.getReadIds(userId)
		]).map(([notifications, readIds]) =>
			notifications.items.filter((notification) => !readIds.has(notification.id)).length
		);
	}

	create(input: NotificationCreateInput): ResultAsync<NotificationRecord, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('notifications').create(
				{
					title: input.title,
					body: input.body,
					targetAll: input.targetAll,
					recipients: input.targetAll ? [] : input.recipients,
					createdBy: auth.value
				},
				pbOptions(this.deps)
			),
			'Failed to create notification.'
		);
	}

	markAsRead(
		userId: string,
		notificationId: string
	): ResultAsync<NotificationReadRecord, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('notification_reads')
				.getFirstListItem<NotificationReadRecord>(
					`user = "${userId}" && notification = "${notificationId}"`,
					pbOptions(this.deps)
				),
			'Failed to mark notification as read.'
		).orElse(() =>
			fromPbPromise(
				this.deps.pocketbase.collection('notification_reads').create<NotificationReadRecord>(
					{
						user: userId,
						notification: notificationId
					},
					pbOptions(this.deps)
				),
				'Failed to mark notification as read.'
			)
		);
	}

	subscribe(
		callback: (event: RecordSubscription<NotificationRecord>) => void
	): ResultAsync<UnsubscribeFunc, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('notifications')
				.subscribe<NotificationRecord>('*', callback, pbOptions(this.deps)),
			'Failed to subscribe to notifications.'
		);
	}

	subscribeReads(
		userId: string,
		callback: (event: RecordSubscription<NotificationReadRecord>) => void
	): ResultAsync<UnsubscribeFunc, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('notification_reads').subscribe<NotificationReadRecord>(
				'*',
				(event) => {
					if (event.record.user === userId) {
						callback(event);
					}
				},
				pbOptions(this.deps)
			),
			'Failed to subscribe to notification reads.'
		);
	}

	appliesToUser(notification: NotificationRecord, userId: string): boolean {
		if (notification.targetAll) {
			return true;
		}

		return notification.recipients?.includes(userId) ?? false;
	}
}
