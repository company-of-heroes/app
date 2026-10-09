import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { NotificationRecord } from '$core/app/database/notifications';
import { database } from '$core/app/database';
import { account } from '$core/account';
import { modal } from '$lib/components/ui/modal';
import { toast } from '$lib/components/ui/toasts';
import { NotificationDetail, type HostNotification } from '@company-of-heroes/ui/notifications';
import { notifyOs } from './os-notification';

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
	#listeners = new Set<() => void>();

	/** Called after realtime changes (new / deleted notification, read elsewhere). */
	onChange(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	#emit(): void {
		for (const listener of this.#listeners) {
			listener();
		}
	}

	async start(): Promise<void> {
		if (this.#started || !account.isAuthenticated) {
			return;
		}

		this.#started = true;
		await this.refresh();
		this.#emit();
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

	async markRead(notificationId: string): Promise<void> {
		const userId = account.userId;

		if (!userId || this.#readIds.has(notificationId)) {
			return;
		}

		await database.notifications.markAsRead(userId, notificationId);
		this.#markLocalRead(notificationId);
	}

	async open(notification: HostNotification): Promise<void> {
		if (!account.userId) {
			return;
		}

		if (!notification.read) {
			await this.markRead(notification.id);
		}

		const matchId = lobbyId(notification);
		if (matchId) {
			const targetComment = commentId(notification);
			const path = resolve('/(loaded)/history/[id]', { id: matchId });
			await goto(targetComment ? `${path}?comment=${encodeURIComponent(targetComment)}` : path);
			return;
		}

		const tournament = tournamentPath(notification);
		if (tournament) {
			await goto(tournament);
			return;
		}

		const memberReplayId = replayId(notification);
		if (memberReplayId) {
			const targetComment = replayCommentId(notification);
			const path = resolve('/(loaded)/replays/[replayId]', { replayId: memberReplayId });
			await goto(targetComment ? `${path}?comment=${encodeURIComponent(targetComment)}` : path);
			return;
		}

		modal.create({
			component: NotificationDetail,
			title: notification.title,
			props: { body: notification.body, url: notification.url },
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
				void this.refresh().then(() => this.#emit());
				toast.info(event.record.title);
				// Tournament news matters while in-game too: also a Windows notification.
				if (event.record.tournament) {
					void notifyOs(event.record.title, event.record.body);
				}
			}

			if (event.action === 'delete') {
				void this.refresh().then(() => this.#emit());
			}
		});

		this.#unsubscribeReads = await database.notifications.subscribeReads(userId, (event) => {
			if (event.action === 'create') {
				this.#markLocalRead(event.record.notification);
				this.#emit();
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

function relationId(value: unknown): string {
	if (!value) {
		return '';
	}

	if (typeof value === 'object' && value !== null && 'id' in value) {
		return String((value as { id: string }).id || '');
	}

	return String(value);
}

function lobbyId(notification: HostNotification): string {
	return relationId(notification.lobby as unknown);
}

function commentId(notification: HostNotification): string {
	return relationId(notification.comment as unknown);
}

/** The app's tournament page for a tournament notice, from its website `url`. */
function tournamentPath(notification: HostNotification): string {
	if (!relationId(notification.tournament as unknown) || !notification.url) {
		return '';
	}

	try {
		const url = new URL(notification.url);
		const slug = /\/tournaments\/([^/]+)/.exec(url.pathname)?.[1];
		if (!slug) {
			return '';
		}

		const path = resolve('/(loaded)/tournaments/[slug]', { slug: decodeURIComponent(slug) });
		const tab = url.searchParams.get('tab');
		return tab ? `${path}?tab=${encodeURIComponent(tab)}` : path;
	} catch {
		return '';
	}
}

function replayId(notification: HostNotification): string {
	return relationId(notification.replay as unknown);
}

function replayCommentId(notification: HostNotification): string {
	return relationId(notification.replayComment as unknown);
}

export const notifications = new NotificationsService();
