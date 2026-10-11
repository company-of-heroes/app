<script lang="ts">
	import { watch } from 'runed';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
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
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const userColumns: ColumnDef<UsersResponse>[] = [
		{ id: 'user', header: t('User'), width: 'w-18/24' },
		{ id: 'actions', header: '', width: 'w-6/24', class: 'justify-end' }
	];

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

	let sentLoading = $state(false);
	const isStaff = $derived(app.account.isStaff);

	watch(
		() => isStaff,
		(enabled) => {
			if (enabled) {
				void loadSent();
			}
		}
	);

	const loadSent = async () => {
		sentLoading = true;
		try {
			sentNotifications = await app.database.notifications.listAll(50);
		} finally {
			sentLoading = false;
		}
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

	{#snippet cell_user({ row }: { row: UsersResponse })}
		<User.Root user={row} class="flex min-w-0 flex-col">
			<User.Name class="font-medium" />
			{#if row.name && row.email}
				<span class="text-secondary-400 text-xs">{row.email}</span>
			{/if}
		</User.Root>
	{/snippet}
	{#snippet cell_remove({ row }: { row: UsersResponse })}
		<Button
			type="button"
			size="sm"
			variant="destructive"
			onclick={() => removeUser(row.id)}
			aria-label={t('Remove {name}', { name: userLabel(row) })}
		>
			<XIcon size={16} />
			{t('Remove')}
		</Button>
	{/snippet}
	{#snippet cell_add({ row }: { row: UsersResponse })}
		<Button
			type="button"
			size="sm"
			variant="secondary"
			disabled={selectedUsers.some((user) => user.id === row.id)}
			onclick={() => addUser(row)}
		>
			<PlusIcon size={16} />
			{t('Add')}
		</Button>
	{/snippet}

	{#if selectedUsers.length > 0}
		<DataTable
			data={selectedUsers}
			columns={userColumns}
			rowKey={(user) => user.id}
			class="rounded-none border-0"
			cells={{ user: cell_user, actions: cell_remove }}
		/>
	{/if}

	{#if searched}
		<section>
			<div class="border-secondary-800 border-b px-4 py-3">
				<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">{t('Users')}</p>
			</div>
			<DataTable
				data={searchResults}
				columns={userColumns}
				rowKey={(user) => user.id}
				empty={t('No users found.')}
				class="rounded-none border-0"
				cells={{ user: cell_user, actions: cell_add }}
			/>
		</section>
	{/if}
{/if}

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Sent notifications')}
		</p>
	</div>

	{#if sentLoading && sentNotifications.length === 0}
		<div class="space-y-2 px-4 py-6">
			<Skeleton class="h-4 w-2/3" />
			<Skeleton class="h-4 w-1/2" />
		</div>
	{:else if sentNotifications.length === 0}
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
