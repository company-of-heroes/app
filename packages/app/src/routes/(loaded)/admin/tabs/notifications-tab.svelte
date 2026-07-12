<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox, Input, Textarea } from '$lib/components/ui/input';
	import { H } from '$lib/components/ui/h';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import type { NotificationRecord } from '$core/app/database/notifications';
	import type { UsersResponse } from '$core/pocketbase/types';
	import dayjs from '$lib/dayjs';
	import XIcon from 'phosphor-svelte/lib/X';

	const sentColumns: ColumnDef<NotificationRecord>[] = [
		{ id: 'title', header: 'Titel', width: 'w-5/24', accessor: (notification) => notification.title, class: 'truncate font-medium' },
		{
			id: 'body',
			header: 'Bericht',
			width: 'w-10/24',
			accessor: (notification) => notification.body,
			class: 'text-secondary-400 truncate text-sm'
		},
		{ id: 'recipients', header: 'Ontvangers', width: 'w-5/24', class: 'text-secondary-400 truncate text-sm' },
		{ id: 'created', header: 'Verstuurd', width: 'w-4/24', class: 'text-secondary-500 text-sm whitespace-nowrap' }
	];

	const searchColumns: ColumnDef<UsersResponse>[] = [
		{ id: 'user', header: '', width: 'w-24/24' }
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
		} finally {
			isSearching = false;
		}
	};

	const addUser = (user: UsersResponse) => {
		selectedUsers = [...selectedUsers, user];
		searchResults = searchResults.filter((result) => result.id !== user.id);
		userQuery = '';
	};

	const removeUser = (userId: string) => {
		selectedUsers = selectedUsers.filter((user) => user.id !== userId);
	};

	const submit = async () => {
		if (!title.trim() || !body.trim()) {
			app.toast.error('Vul een titel en bericht in.');
			return;
		}

		if (!targetAll && selectedUsers.length === 0) {
			app.toast.error('Selecteer minstens één ontvanger of kies "alle gebruikers".');
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

			app.toast.success('Notificatie verstuurd.');
			title = '';
			body = '';
			targetAll = false;
			selectedUsers = [];
			searchResults = [];
			userQuery = '';
			await loadSent();
		} catch (error) {
			console.error('[NOTIFICATIONS]: create failed:', error);
			app.toast.error('Kon notificatie niet versturen.');
		} finally {
			isSubmitting = false;
		}
	};
</script>

<Form.Root class="max-w-2xl">
	<Form.Group>
		<Form.Label>Titel</Form.Label>
		<Form.Description>Korte titel die in de notificatielijst verschijnt.</Form.Description>
		<Input bind:value={title} placeholder="Titel" maxlength={200} />
	</Form.Group>

	<Form.Group>
		<Form.Label>Bericht</Form.Label>
		<Form.Description>Volledige inhoud die in de modal wordt getoond.</Form.Description>
		<Textarea bind:value={body} rows={6} maxlength={10000} placeholder="Schrijf je bericht..." />
	</Form.Group>

	<Form.Group>
		<Checkbox label="Verstuur naar alle gebruikers" bind:checked={targetAll} />
	</Form.Group>

	{#if !targetAll}
		<Form.Group>
			<Form.Label>Ontvangers</Form.Label>
			<Form.Description>Zoek gebruikers op naam of e-mailadres en voeg ze toe.</Form.Description>
			<div class="flex gap-2">
				<Input
					bind:value={userQuery}
					placeholder="Zoek op naam of e-mail..."
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void searchUsers();
						}
					}}
				/>
				<Button type="button" variant="secondary" onclick={() => searchUsers()} loading={isSearching}>
					Zoeken
				</Button>
			</div>

			{#if searchResults.length > 0}
				{#snippet cell_user({ row }: { row: UsersResponse })}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-auto w-full justify-start px-0 py-0 text-left text-sm"
						onclick={() => addUser(row)}
					>
						<span class="block">{userLabel(row)}</span>
						{#if row.name && row.email}
							<span class="text-secondary-400 text-xs">{row.email}</span>
						{/if}
					</Button>
				{/snippet}
				<DataTable
					data={searchResults}
					columns={searchColumns}
					rowKey={(user) => user.id}
					showHeader={false}
					cells={{ user: cell_user }}
				/>
			{/if}

			{#if selectedUsers.length > 0}
				<div class="mt-3 flex flex-wrap gap-2">
					{#each selectedUsers as user (user.id)}
						<Badge class="inline-flex items-center gap-2">
							{userLabel(user)}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								class="text-secondary-400 hover:text-white"
								onclick={() => removeUser(user.id)}
								aria-label="Verwijder {userLabel(user)}"
							>
								<XIcon size={14} />
							</Button>
						</Badge>
					{/each}
				</div>
			{/if}
		</Form.Group>
	{/if}

	<Button type="button" onclick={() => submit()} loading={isSubmitting}>Versturen</Button>
</Form.Root>

<section class="mt-12">
	<H level="2">Verzonden notificaties</H>
	{#if sentNotifications.length === 0}
		<p class="text-secondary-400 mt-4 text-sm">Nog geen notificaties verstuurd.</p>
	{:else}
		{#snippet cell_recipients({ row }: { row: NotificationRecord })}
			{row.targetAll ? 'Alle gebruikers' : `${row.recipients?.length ?? 0} ontvanger(s)`}
		{/snippet}
		{#snippet cell_created({ row }: { row: NotificationRecord })}
			{dayjs(row.created).format('D MMM YYYY HH:mm')}
		{/snippet}
		<DataTable
			class="mt-4"
			data={sentNotifications}
			columns={sentColumns}
			rowKey={(notification) => notification.id}
			cells={{ recipients: cell_recipients, created: cell_created }}
		/>
	{/if}
</section>
