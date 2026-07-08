import type { NotificationRecord } from '$core/app/database/notifications';
import { database } from '$core/app/database';
import { account } from '$core/account';
import { modal } from '$lib/components/ui/modal';
import { toast } from 'svelte-sonner';
import NotificationDetail from '$lib/components/notifications/notification-detail.svelte';

export type NotificationItem = NotificationRecord & {
	read: boolean;
};

/**
 * Reactive notification inbox: loads, realtime updates, and modal detail.
 */
export class NotificationsService {
	items = $state<NotificationItem[]>([]);
	unreadCount = $state(0);
	isLoading = $state(false);

	#readIds = $state.raw<Set<string>>(new Set());
	#unsubscribeNotifications: (() => Promise<void>) | null = null;
	#unsubscribeReads: (() => Promise<void>) | null = null;
	#started = false;

	async start(): Promise<void> {
		if (this.#started || !account.isAuthenticated) {
			return;
		}

		this.#started = true;
		await this.refresh();
		await this.#subscribe();
	}

	async stop(): Promise<void> {
		if (!this.#started) {
			return;
		}

		this.#started = false;
		await this.#unsubscribeNotifications?.();
		await this.#unsubscribeReads?.();

		this.#unsubscribeNotifications = null;
		this.#unsubscribeReads = null;
		this.items = [];
		this.unreadCount = 0;
		this.#readIds = new Set();
	}

	async refresh(): Promise<void> {
		const userId = account.userId;

		if (!userId) {
			return;
		}

		this.isLoading = true;

		try {
			const [notifications, readIds, unreadCount] = await Promise.all([
				database.notifications.listForUser(userId, 10),
				database.notifications.getReadIds(userId),
				database.notifications.countUnread(userId)
			]);

			this.#readIds = readIds;
			this.unreadCount = unreadCount;
			this.items = notifications.map((notification) => ({
				...notification,
				read: readIds.has(notification.id)
			}));
		} finally {
			this.isLoading = false;
		}
	}

	async open(notification: NotificationItem): Promise<void> {
		const userId = account.userId;

		if (!userId) {
			return;
		}

		if (!notification.read) {
			await database.notifications.markAsRead(userId, notification.id);
			this.#markLocalRead(notification.id);
		}

		modal.create({
			component: NotificationDetail,
			title: notification.title,
			props: { body: notification.body },
			size: 'md'
		});
		modal.open();
	}

	async #subscribe(): Promise<void> {
		const userId = account.userId;

		if (!userId) {
			return;
		}

		await this.#unsubscribeNotifications?.();
		await this.#unsubscribeReads?.();

		this.#unsubscribeNotifications = await database.notifications.subscribe((event) => {
			if (event.action === 'create' && database.notifications.appliesToUser(event.record, userId)) {
				void this.refresh();
				toast.info(event.record.title);
			}

			if (event.action === 'delete') {
				void this.refresh();
			}
		});

		this.#unsubscribeReads = await database.notifications.subscribeReads(userId, (event) => {
			if (event.action === 'create') {
				this.#markLocalRead(event.record.notification);
			}
		});
	}

	#markLocalRead(notificationId: string): void {
		if (this.#readIds.has(notificationId)) {
			return;
		}

		const nextReadIds = new Set(this.#readIds);
		nextReadIds.add(notificationId);
		this.#readIds = nextReadIds;

		this.items = this.items.map((item) =>
			item.id === notificationId ? { ...item, read: true } : item
		);

		if (this.unreadCount > 0) {
			this.unreadCount -= 1;
		}
	}
}

export const notifications = new NotificationsService();
