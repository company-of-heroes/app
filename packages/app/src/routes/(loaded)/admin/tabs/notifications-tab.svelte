<script lang="ts">
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import * as Form from '$lib/components/ui/form';
	import { Input, Textarea } from '$lib/components/ui/input';
	import * as User from '$lib/components/user';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import type { NotificationRecord } from '$core/app/database/notifications';
	import type { UsersResponse } from '$core/pocketbase/types';
	import dayjs from '$lib/dayjs';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import PaperPlaneTiltIcon from 'phosphor-svelte/lib/PaperPlaneTiltIcon';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { cn } from '$lib/utils';
	import { footerAction, interactive } from '$lib/components/ui/variants';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const sentColumns: ColumnDef<NotificationRecord>[] = [
		{
			id: 'title',
			header: t('Title'),
			width: 'w-5/24',
			accessor: (notification) => notification.title,
			class: 'truncate font-medium'
		},
		{
			id: 'body',
			header: t('Message'),
			width: 'w-10/24',
			accessor: (notification) => notification.body,
			class: 'text-secondary-400 truncate text-sm'
		},
		{
			id: 'recipients',
			header: t('Recipients'),
			width: 'w-5/24',
			class: 'text-secondary-400 truncate text-sm'
		},
		{
			id: 'created',
			header: t('Sent'),
			width: 'w-4/24',
			class: 'text-secondary-500 text-sm whitespace-nowrap'
		}
	];

	let title = $state('');
	let body = $state('');
	let targetAll = $state(false);
	let userQuery = $state('');
	let selectedUsers = $state<UsersResponse[]>([]);
	let searchResults = $state<UsersResponse[]>([]);
	let sentNotifications = $state<NotificationRecord[]>([]);
	let isSubmitting = $state(false);
	let isSearching = $state(false);
	let searched = $state(false);
	const canSend = $derived(
		title.trim().length > 0 &&
			body.trim().length > 0 &&
			(targetAll || selectedUsers.length > 0) &&
			!isSubmitting
	);
	const canSearch = $derived(userQuery.trim().length >= 2 && !isSearching);

	$effect(() => {
		if (app.account.isStaff) {
			void loadSent();
		}
	});

	const loadSent = async () => {
		sentNotifications = await app.database.notifications.listAll(50);
	};

	const userLabel = (user: UsersResponse) => user.name || user.email || user.id;

	const searchUsers = async () => {
		const query = userQuery.trim();

		if (query.length < 2) {
			searchResults = [];
			searched = false;
			return;
		}

		isSearching = true;

		try {
			const escaped = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			const response = await pocketbase.collection('users').getList<UsersResponse>(1, 10, {
				filter: `name ~ "${escaped}" || email ~ "${escaped}"`,
				sort: 'name',
				fetch
			});

			searchResults = response.items.filter(
				(user) => !selectedUsers.some((selected) => selected.id === user.id)
			);
			searched = true;
		} finally {
			isSearching = false;
		}
	};

	const addUser = (user: UsersResponse) => {
		selectedUsers = [...selectedUsers, user];
		searchResults = searchResults.filter((result) => result.id !== user.id);
		userQuery = '';
		searched = false;
	};

	const toggleAllUsers = () => {
		targetAll = !targetAll;
		if (targetAll) {
			userQuery = '';
			searchResults = [];
			searched = false;
		}
	};

	const removeUser = (userId: string) => {
		selectedUsers = selectedUsers.filter((user) => user.id !== userId);
	};

	const submit = async () => {
		if (!title.trim() || !body.trim()) {
			app.toast.error(t('Enter a title and message.'));
			return;
		}

		if (!targetAll && selectedUsers.length === 0) {
			app.toast.error(t('Select at least one recipient or choose all users.'));
			return;
		}

		isSubmitting = true;

		try {
			await app.database.notifications.create({
				title: title.trim(),
				body: body.trim(),
				targetAll,
				recipients: targetAll ? [] : selectedUsers.map((user) => user.id)
			});

			app.toast.success(t('Notification sent.'));
			title = '';
			body = '';
			targetAll = false;
			selectedUsers = [];
			searchResults = [];
			userQuery = '';
			searched = false;
			await loadSent();
		} catch (error) {
			console.error('[NOTIFICATIONS]: create failed:', error);
			app.toast.error(t('Could not send notification.'));
		} finally {
			isSubmitting = false;
		}
	};
</script>

<Form.Group
	layout="stacked"
	label={t('New notification')}
	description={t('Write a title and message. Markdown is supported.')}
>
	<Input bind:value={title} placeholder={t('Title')} maxlength={200} aria-label={t('Title')} />
	<Textarea
		bind:value={body}
		class="min-h-24 resize-none"
		rows={5}
		maxlength={10000}
		placeholder={t('Write your message...')}
		aria-label={t('Message')}
	/>
	{#snippet footer()}
		<Button
			type="button"
			variant={targetAll ? 'primary' : 'secondary'}
			class="w-fit"
			aria-pressed={targetAll}
			onclick={toggleAllUsers}
		>
			<UsersIcon size={16} />
			{t('Send to all')}
		</Button>
		<Button
			type="button"
			class="w-fit"
			disabled={!canSend}
			loading={isSubmitting}
			onclick={() => submit()}
		>
			<PaperPlaneTiltIcon size={16} />
			{t('Send')}
		</Button>
	{/snippet}
</Form.Group>

{#if !targetAll}
	<Form.Group
		inputId="notification-recipients"
		label={t('Recipients')}
		description={t('Search by name or email, then add them.')}
	>
		<Input
			id="notification-recipients"
			bind:value={userQuery}
			placeholder={t('Search by name or email...')}
			aria-label={t('Recipients')}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void searchUsers();
				}
			}}
		/>
		<Button
			type="button"
			variant="secondary"
			class="w-fit shrink-0"
			disabled={!canSearch}
			loading={isSearching}
			onclick={() => searchUsers()}
		>
			<MagnifyingGlassIcon size={16} />
			{t('Search')}
		</Button>
	</Form.Group>

	{#if selectedUsers.length > 0}
		<ul class="divide-secondary-800 divide-y">
			{#each selectedUsers as user (user.id)}
				<li class="flex min-h-11 items-stretch">
					<div class="flex min-w-0 flex-1 items-center px-4 py-2">
						<User.Root {user} class="flex min-w-0 flex-col">
							<User.Name class="font-medium" />
							{#if user.name && user.email}
								<span class="text-secondary-400 text-xs">{user.email}</span>
							{/if}
						</User.Root>
					</div>
					<div class="border-secondary-800 flex items-stretch border-l">
						<Button
							type="button"
							variant="ghost"
							class={cn(footerAction, 'text-secondary-400 hover:text-white', 'border-r-0')}
							onclick={() => removeUser(user.id)}
							aria-label={t('Remove {name}', { name: userLabel(user) })}
						>
							<XIcon size={16} />
							{t('Remove')}
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if searched}
		<section>
			<div class="border-secondary-800 border-b px-4 py-3">
				<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">{t('Users')}</p>
			</div>
			{#if searchResults.length === 0}
				<p class="text-secondary-400 px-4 py-6 text-sm">{t('No users found.')}</p>
			{:else}
				<ul class="divide-secondary-800 divide-y">
					{#each searchResults as user (user.id)}
						<li>
							<button
								type="button"
								class={cn(
									interactive,
									'hover:bg-secondary-950/50 flex min-h-11 w-full flex-col justify-center px-4 py-2 text-left transition-colors'
								)}
								onclick={() => addUser(user)}
							>
								<User.Root {user} class="flex min-w-0 flex-col">
									<User.Name class="font-medium" />
									{#if user.name && user.email}
										<span class="text-secondary-400 text-xs">{user.email}</span>
									{/if}
								</User.Root>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
{/if}

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Sent notifications')}
		</p>
	</div>

	{#if sentNotifications.length === 0}
		<p class="text-secondary-400 px-4 py-6 text-sm">{t('No notifications sent yet.')}</p>
	{:else}
		{#snippet cell_recipients({ row }: { row: NotificationRecord })}
			{row.targetAll
				? t('All users')
				: t('{count} recipient(s)', { count: row.recipients?.length ?? 0 })}
		{/snippet}
		{#snippet cell_created({ row }: { row: NotificationRecord })}
			{dayjs(row.created).format('D MMM YYYY HH:mm')}
		{/snippet}
		<DataTable
			data={sentNotifications}
			columns={sentColumns}
			rowKey={(notification) => notification.id}
			class="rounded-none border-0"
			cells={{ recipients: cell_recipients, created: cell_created }}
		/>
	{/if}
</section>
