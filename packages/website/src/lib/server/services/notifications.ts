import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { NotificationRecord } from '@company-of-heroes/api';
import type { HostNotification } from '@company-of-heroes/ui/notifications';
import type { AuthUserPublic } from '$lib/auth/user';
import type { Task } from '../result';
import { Service } from './service';

const LIST_LIMIT = 20;

function toHostNotification(record: NotificationRecord, readIds: Set<string>): HostNotification {
	return {
		id: record.id,
		title: record.title,
		body: record.body ?? '',
		created: record.created,
		read: readIds.has(record.id),
		lobby: record.lobby || undefined,
		comment: record.comment || undefined,
		replay: record.replay || undefined,
		replayComment: record.replayComment || undefined,
		url: record.url || undefined,
		tournament: record.tournament || undefined
	};
}

/**
 * The signed-in user's notifications for the website bell. Reads go through the user-authed
 * client (`locals.api`), so the collection rules decide what the user sees.
 */
export class NotificationsService extends Service {
	private get api() {
		return this.locals.api.notifications;
	}

	list(user: AuthUserPublic): Task<HostNotification[]> {
		return ResultAsync.combine([
			this.api.listForUser(user.id, LIST_LIMIT),
			this.api.getReadIds(user.id)
		] as const).map(([records, readIds]) =>
			records.map((record) => toHostNotification(record, readIds))
		);
	}

	unreadCount(user: AuthUserPublic): Task<number> {
		return this.api.countUnread(user.id);
	}

	/** Idempotent: a read row that already exists (or loses the unique-index race) is fine. */
	markRead(user: AuthUserPublic, id: string): Task<void> {
		return this.api
			.markAsRead(user.id, id)
			.map(() => undefined)
			.orElse((error) => (error.status === 400 ? okAsync(undefined) : errAsync(error)));
	}
}
