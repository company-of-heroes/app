<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import * as User from '$lib/components/user';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import { UsersRoleOptions, type UsersResponse } from '$core/pocketbase/types';
	import { ClientResponseError } from 'pocketbase';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SignInIcon from 'phosphor-svelte/lib/SignInIcon';
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import { useI18n } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { PlayerProfileLink } from '@company-of-heroes/ui/player';
	import type { SteamConflict, SteamConflictAccount } from '@company-of-heroes/api';
	import { api } from '$core/api';
	import { onMount } from 'svelte';

	const { t } = useI18n();

	let userQuery = $state('');
	let searchResults = $state.raw<UsersResponse[]>([]);
	let isSearching = $state(false);
	let impersonatingId = $state<string | null>(null);
	let searched = $state(false);
	const canSearch = $derived(userQuery.trim().length >= 2 && !isSearching);

	const columns: ColumnDef<UsersResponse>[] = [
		{ id: 'user', header: t('Name'), width: 'w-9/24' },
		{ id: 'role', header: t('Role'), width: 'w-4/24' },
		{ id: 'reputation', header: t('Reputation'), width: 'w-3/24', class: 'tabular-nums' },
		{ id: 'actions', header: '', width: 'w-8/24', class: 'text-right' }
	];

	const userLabel = (user: UsersResponse) => user.name || user.email || user.id;

	const roleLabel = (role: UsersResponse['role']) => {
		if (role === UsersRoleOptions.admin) {
			return t('Admin');
		}

		if (role === UsersRoleOptions.moderator) {
			return t('Moderator');
		}

		return '';
	};

	const profileSteamId = (user: UsersResponse) => {
		if (!Array.isArray(user.steamIds)) {
			return '';
		}

		return user.steamIds.map(String).find(Boolean) ?? '';
	};

	let conflicts = $state.raw<SteamConflict[]>([]);
	let busyConflictId = $state<string | null>(null);
	const isAdmin = $derived(app.account.isAdmin);

	const conflictAccounts = (conflict: SteamConflict) =>
		[conflict.requester, ...conflict.owners].filter(
			(account): account is SteamConflictAccount => account !== null
		);

	const loadConflicts = async () => {
		const result = await api.auth.listSteamConflicts();
		if (result.isErr()) {
			app.toast.error(t(result.error.message));
			return;
		}

		conflicts = result.value;
	};

	const keepAccount = async (conflict: SteamConflict, keeper: SteamConflictAccount) => {
		const others = conflictAccounts(conflict).filter((account) => account.id !== keeper.id);
		const confirmed = await confirm(
			t(
				'Merge {count} account(s) into {name}? Their matches, replays and comments move over and the accounts are deleted.',
				{
					count: others.length,
					name: keeper.name || keeper.id
				}
			),
			{ okLabel: t('Merge'), cancelLabel: t('Cancel'), kind: 'warning' }
		);
		if (!confirmed) {
			return;
		}

		busyConflictId = conflict.id;
		const result = await api.auth.mergeAccounts(
			keeper.id,
			others.map((account) => account.id)
		);
		busyConflictId = null;
		if (result.isErr()) {
			app.toast.error(t(result.error.message));
			return;
		}

		app.toast.success(t('Accounts merged.'));
		await loadConflicts();
	};

	const dismissConflict = async (conflict: SteamConflict) => {
		busyConflictId = conflict.id;
		const result = await api.auth.dismissSteamConflict(conflict.id);
		busyConflictId = null;
		if (result.isErr()) {
			app.toast.error(t(result.error.message));
			return;
		}

		conflicts = conflicts.filter((row) => row.id !== conflict.id);
	};

	onMount(() => {
		void loadConflicts();
	});

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
			const response = await pocketbase.collection('users').getList<UsersResponse>(1, 20, {
				filter: `name ~ "${escaped}" || email ~ "${escaped}"`,
				sort: 'name',
				fetch
			});
			searchResults = response.items;
			searched = true;
		} catch (error) {
			console.error('[ADMIN]: user search failed:', error);
			app.toast.error(t('Could not search users.'));
		} finally {
			isSearching = false;
		}
	};

	const loginAs = async (user: UsersResponse) => {
		if (user.id === app.account.userId) {
			return;
		}

		const confirmed = await confirm(
			t('You will be signed in as {name}. You can return to your own account at any time.', {
				name: userLabel(user)
			}),
			{ okLabel: t('Login as user'), cancelLabel: t('Cancel'), kind: 'warning' }
		);
		if (!confirmed) {
			return;
		}

		impersonatingId = user.id;
		try {
			await app.account.impersonate(user.id);
			app.toast.success(t('Signed in as {name}.', { name: userLabel(user) }));
			void goto(resolve('/'));
		} catch (error) {
			console.error('[ADMIN]: impersonate failed:', error);
			const message =
				error instanceof ClientResponseError
					? (typeof error.response?.message === 'string' && error.response.message) || error.message
					: error instanceof Error
						? error.message
						: t('Could not sign in as this user');
			app.toast.error(message);
		} finally {
			impersonatingId = null;
		}
	};
</script>

{#if conflicts.length > 0}
	<section class="border-secondary-800 mb-6 border-b">
		<div class="border-secondary-800 border-b px-4 py-3">
			<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
				{t('Steam conflicts')}
			</p>
			<p class="text-secondary-400 mt-1 text-xs">
				{t('These Steam IDs are claimed by more than one account. Pick the account to keep.')}
			</p>
		</div>
		<ul class="divide-secondary-800 divide-y">
			{#each conflicts as conflict (conflict.id)}
				<li class="flex flex-col gap-2 px-4 py-3">
					<span class="flex items-center gap-2 text-sm">
						<span class="font-mono">{conflict.steamId}</span>
						{#if !conflict.requester}
							<Badge variant="default">{t('Already shared')}</Badge>
						{/if}
					</span>
					<ul class="flex flex-col gap-1">
						{#each conflictAccounts(conflict) as account (account.id)}
							<li class="flex items-center gap-2 text-sm">
								<span class="min-w-0 flex-1 truncate">
									{account.name || account.id}
									{#if account.id === conflict.requester?.id}
										<Badge variant="default">{t('Requested')}</Badge>
									{/if}
									{#if roleLabel(account.role as UsersResponse['role'])}
										<Badge variant="primary"
											>{roleLabel(account.role as UsersResponse['role'])}</Badge
										>
									{/if}
								</span>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									disabled={!isAdmin || busyConflictId !== null}
									loading={busyConflictId === conflict.id}
									onclick={() => keepAccount(conflict, account)}
								>
									{t('Keep this account')}
								</Button>
							</li>
						{/each}
					</ul>
					{#if conflict.requester}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="w-fit"
							disabled={busyConflictId !== null}
							onclick={() => dismissConflict(conflict)}
						>
							{t('Dismiss')}
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<Form.Group
	inputId="admin-user-search"
	label={t('Find a user')}
	description={t('Search by name or email, then sign in as that account.')}
>
	<Input
		id="admin-user-search"
		bind:value={userQuery}
		placeholder={t('Search by name or email...')}
		aria-label={t('Find a user')}
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

{#if searched}
	<section>
		<div class="border-secondary-800 border-b px-4 py-3">
			<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">{t('Users')}</p>
		</div>
		{#snippet cell_user({ row }: { row: UsersResponse })}
			{@const steamId = profileSteamId(row)}
			<User.Root user={row} class="flex min-w-0 flex-col">
				{#if steamId}
					<PlayerProfileLink
						href={resolve('/(loaded)/players/[id]', { id: steamId })}
						playerId={steamId}
						class={cn(interactive, 'hover:text-primary min-w-0 truncate transition-colors')}
					>
						<User.Name class="font-medium" />
					</PlayerProfileLink>
				{:else}
					<User.Name class="truncate font-medium" />
				{/if}
				{#if row.name && row.email}
					<span class="text-secondary-500 truncate text-xs">{row.email}</span>
				{/if}
			</User.Root>
		{/snippet}
		{#snippet cell_role({ row }: { row: UsersResponse })}
			{#if roleLabel(row.role)}
				<Badge variant="primary">{roleLabel(row.role)}</Badge>
			{:else}
				<span class="text-secondary-500">—</span>
			{/if}
		{/snippet}
		{#snippet cell_reputation({ row }: { row: UsersResponse })}
			{row.reputation || 0}
		{/snippet}
		{#snippet cell_actions({ row }: { row: UsersResponse })}
			{@const steamId = profileSteamId(row)}
			<div class="flex justify-end gap-2">
				{#if steamId}
					<Button
						href={resolve('/(loaded)/players/[id]', { id: steamId })}
						variant="secondary"
						size="sm"
					>
						<UserIcon size={16} />
						{t('View Profile')}
					</Button>
				{/if}
				<Button
					type="button"
					variant="secondary"
					size="sm"
					disabled={row.id === app.account.userId}
					loading={impersonatingId === row.id}
					onclick={() => loginAs(row)}
				>
					<SignInIcon size={16} />
					{t('Login as')}
				</Button>
			</div>
		{/snippet}
		<DataTable
			data={searchResults}
			{columns}
			rowKey={(row) => row.id}
			empty={t('No users found.')}
			class="rounded-none border-0"
			cells={{
				user: cell_user,
				role: cell_role,
				reputation: cell_reputation,
				actions: cell_actions
			}}
		/>
	</section>
{/if}
