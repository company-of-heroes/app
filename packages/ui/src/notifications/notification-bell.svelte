<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import BellIcon from 'phosphor-svelte/lib/BellIcon';
	import { onMount } from 'svelte';
	import { formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { Popover, type PopoverProps } from '../ui/popover';
	import { Skeleton } from '../ui/skeleton';
	import { dropdownHeader, interactive } from '../variants';
	import type { HostNotification } from './types';

	type Props = {
		side?: PopoverProps['side'];
		align?: PopoverProps['align'];
		sideOffset?: number;
		/** Replaces the default trigger styling (e.g. a header cell on the website). */
		triggerClass?: string;
		/** How often hosts without realtime are polled for the unread count. */
		pollMs?: number;
	};

	let {
		side = 'bottom',
		align = 'end',
		sideOffset = 8,
		triggerClass,
		pollMs = 60_000
	}: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const skeletonRows = [0, 1, 2];

	let open = $state(false);
	let items = $state.raw<HostNotification[]>([]);
	let unread = $state(0);
	let loading = $state(false);
	const badgeLabel = $derived(unread > 9 ? '9+' : String(unread));

	async function loadCount() {
		try {
			unread = await host.api.notifications.unreadCount();
		} catch {
			// Offline or signed out meanwhile: try again next time.
		}
	}

	async function loadList() {
		loading = true;
		try {
			// In order: a host may refresh its inbox in `list` and answer the count from it.
			items = await host.api.notifications.list();
			unread = await host.api.notifications.unreadCount();
		} catch {
			// Keep what is shown; the next open tries again.
		} finally {
			loading = false;
		}
	}

	function onOpenChange(next: boolean) {
		open = next;
		if (next) {
			void loadList();
		}
	}

	async function openNotification(notification: HostNotification) {
		open = false;
		if (!notification.read) {
			items = items.map((item) => (item.id === notification.id ? { ...item, read: true } : item));
			unread = Math.max(0, unread - 1);
			try {
				await host.api.notifications.markRead(notification.id);
			} catch {
				// Still open it; it shows as unread again on the next load.
			}
		}

		host.openNotification({ ...notification, read: true });
	}

	onMount(() => {
		void loadCount();
		const subscribe = host.api.notifications.subscribe;
		if (subscribe) {
			return subscribe(() => {
				void (open ? loadList() : loadCount());
			});
		}

		// No realtime: poll while the tab is visible, and right when it becomes visible again.
		const poll = () => {
			if (document.visibilityState === 'visible') {
				void loadCount();
			}
		};
		const timer = setInterval(poll, pollMs);
		document.addEventListener('visibilitychange', poll);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', poll);
		};
	});
</script>

<Popover
	bind:open
	{onOpenChange}
	{side}
	{align}
	{sideOffset}
	contentClass="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
>
	{#snippet trigger({ props })}
		<Button
			{...props}
			variant="ghost"
			size="icon-sm"
			class={cn(
				'relative',
				triggerClass ??
					'bg-secondary-800 text-secondary-400 hover:text-primary hover:bg-secondary-700 data-[state=open]:bg-secondary-700 data-[state=open]:text-primary'
			)}
			aria-label={unread > 0
				? t('Notifications ({count} unread)', { count: unread })
				: t('Notifications')}
		>
			<BellIcon size={18} weight="duotone" />
			{#if unread > 0}
				<span
					class={cn(
						'bg-primary text-secondary-950 absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] leading-none font-bold tabular-nums',
						badgeLabel.length > 1 ? 'h-4 min-w-4 px-1' : 'size-4'
					)}
				>
					{badgeLabel}
				</span>
			{/if}
		</Button>
	{/snippet}
	<div class={dropdownHeader}>
		<h2 class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Notifications')}
		</h2>
		{#if unread > 0}
			<Badge variant="primary">{t('{count} unread', { count: unread })}</Badge>
		{:else}
			<span class="text-secondary-500 text-xs">{t('All read')}</span>
		{/if}
	</div>
	<div class="max-h-90 overflow-y-auto">
		{#if loading && items.length === 0}
			<div class="divide-secondary-800 divide-y">
				{#each skeletonRows as row (row)}
					<div class="border-l-2 border-transparent px-4 py-2.5">
						<div class="flex min-w-0 flex-col gap-1.5">
							<Skeleton class="h-3.5 w-4/5" />
							<Skeleton class="h-3 w-16" />
						</div>
					</div>
				{/each}
			</div>
		{:else if items.length === 0}
			<div
				class="text-secondary-400 flex flex-col items-center gap-2 px-4 py-8 text-center text-sm"
			>
				<BellIcon size={28} weight="duotone" class="text-secondary-600" />
				<p>{t('No notifications')}</p>
			</div>
		{:else}
			<ul class="divide-secondary-800 divide-y">
				{#each items as notification (notification.id)}
					<li>
						<button
							type="button"
							class={cn(
								interactive,
								'hover:bg-secondary-800/40 flex w-full flex-col border-l-2 px-4 py-2.5 text-left transition-colors',
								notification.read ? 'border-transparent' : 'bg-secondary-950/80 border-primary'
							)}
							onclick={() => openNotification(notification)}
						>
							<span
								class={cn(
									'line-clamp-2 text-sm',
									notification.read ? 'text-secondary-300' : 'font-medium text-white'
								)}
							>
								{notification.title}
							</span>
							<time
								class="text-secondary-500 mt-0.5 text-xs tabular-nums"
								datetime={notification.created}
							>
								{formatRelative(
									Date.parse(notification.created.replace(' ', 'T')) / 1000,
									host.locale()
								)}
							</time>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Popover>
