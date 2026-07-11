<script lang="ts">
	import { cn } from '$lib/utils';
	import { Popover } from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import BellIcon from 'phosphor-svelte/lib/Bell';
	import dayjs from '$lib/dayjs';
	import { app } from '$core/app/context';
	import type { NotificationItem } from '$core/notifications/notifications.svelte';

	let open = $state(false);

	const onOpenChange = (next: boolean) => {
		open = next;

		if (next) {
			void app.notifications.refresh();
		}
	};

	const openNotification = async (notification: NotificationItem) => {
		open = false;
		await app.notifications.open(notification);
	};
</script>

<Popover
	bind:open
	{onOpenChange}
	side="right"
	align="center"
	sideOffset={12}
	contentClass="bg-secondary-950 w-[300px] overflow-hidden p-0"
>
	{#snippet trigger({ props })}
		<Button
			{...props}
			variant="ghost"
			size="icon-sm"
			class="bg-secondary-800 text-secondary-400 hover:text-primary hover:bg-secondary-700 data-[state=open]:bg-secondary-700 data-[state=open]:text-primary relative"
			aria-label="Notificaties"
		>
			<BellIcon size={18} weight="duotone" />
			{#if app.notifications.unreadCount > 0}
				{@const badgeLabel =
					app.notifications.unreadCount > 9 ? '9+' : String(app.notifications.unreadCount)}
				<span
					class={cn(
						'bg-primary text-secondary-950 absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none tabular-nums',
						badgeLabel.length > 1 ? 'h-4 min-w-4 px-1' : 'size-4'
					)}
				>
					{badgeLabel}
				</span>
			{/if}
		</Button>
	{/snippet}
	{#snippet children()}
		<div class="border-secondary-700 flex items-baseline justify-between border-b px-4 py-3">
			<h2 class="text-sm font-bold text-white">Notificaties</h2>
			{#if app.notifications.unreadCount > 0}
				<span class="text-primary text-xs font-semibold">
					{app.notifications.unreadCount} ongelezen
				</span>
			{:else}
				<span class="text-secondary-500 text-xs">Alles gelezen</span>
			{/if}
		</div>

		<div class="max-h-[360px] overflow-y-auto">
			{#if app.notifications.isLoading && app.notifications.items.length === 0}
				<p class="text-secondary-400 px-4 py-8 text-center text-sm">Laden...</p>
			{:else if app.notifications.items.length === 0}
				<p class="text-secondary-400 px-4 py-8 text-center text-sm">Geen notificaties</p>
			{:else}
				<ul class="divide-secondary-800/80 divide-y">
					{#each app.notifications.items as notification (notification.id)}
						<li>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								class={cn(
									'h-auto w-full justify-start px-4 py-3 text-left',
									!notification.read
										? 'bg-secondary-900 text-white hover:bg-secondary-800'
										: 'text-secondary-300 hover:bg-secondary-900'
								)}
								onclick={() => openNotification(notification)}
							>
								<span class={cn('block text-sm', !notification.read && 'font-bold')}>
									{notification.title}
								</span>
								<time
									class="text-secondary-500 mt-0.5 block text-xs"
									datetime={notification.created}
								>
									{dayjs(notification.created).fromNow()}
								</time>
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/snippet}
</Popover>
