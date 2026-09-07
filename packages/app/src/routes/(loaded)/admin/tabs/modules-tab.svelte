<script lang="ts">
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox, Input } from '$lib/components/ui/input';
	import * as Form from '$lib/components/ui/form';
	import * as User from '$lib/components/user';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import type {
		AntiCheatModuleAllowlistResponse,
		AntiCheatModuleHitsResponse,
		UsersResponse
	} from '$core/pocketbase/types';
	import dayjs from '$lib/dayjs';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	type HitRow = AntiCheatModuleHitsResponse<{ user?: UsersResponse }>;

	const escapeFilterValue = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

	const allowlistColumns: ColumnDef<AntiCheatModuleAllowlistResponse>[] = [
		{ id: 'name', header: t('Module or path'), width: 'w-8/24', class: 'font-medium' },
		{ id: 'label', header: t('Label'), width: 'w-7/24', class: 'text-secondary-400 text-sm' },
		{
			id: 'actions',
			header: t('Enabled'),
			width: 'w-9/24',
			headerClass: 'text-right',
			class: 'text-right'
		}
	];

	const hitColumns: ColumnDef<HitRow>[] = [
		{ id: 'user', header: t('Player'), width: 'w-3/24', class: 'font-medium' },
		{ id: 'module', header: t('Module'), width: 'w-4/24' },
		{
			id: 'path',
			header: t('Path'),
			width: 'w-9/24',
			class: 'text-secondary-500 text-sm'
		},
		{
			id: 'session',
			header: t('Session'),
			width: 'w-3/24',
			class: 'text-secondary-500 text-sm tabular-nums'
		},
		{
			id: 'actions',
			header: t('Detected'),
			width: 'w-5/24',
			headerClass: 'text-right',
			class: 'text-right'
		}
	];

	let name = $state('');
	let label = $state('');
	let enabled = $state(true);
	let allowlist = $state<AntiCheatModuleAllowlistResponse[]>([]);
	let hits = $state<HitRow[]>([]);
	let isSaving = $state(false);
	let deletingId = $state<string | null>(null);
	let togglingId = $state<string | null>(null);
	let allowingId = $state<string | null>(null);
	const canAdd = $derived(name.trim().length > 0 && !isSaving);

	$effect(() => {
		if (app.account.isStaff) {
			void loadAllowlist();
			void loadHits();
		}
	});

	const userLabel = (hit: HitRow) => {
		const user = hit.expand?.user;
		return user?.name || user?.email || hit.user;
	};

	const loadAllowlist = async () => {
		try {
			allowlist = await pocketbase
				.collection('anti_cheat_module_allowlist')
				.getFullList<AntiCheatModuleAllowlistResponse>({
					sort: 'name',
					fetch
				});
		} catch (error) {
			console.error('[ADMIN]: module allowlist load failed:', error);
			app.toast.error(t('Could not load module allowlist.'));
		}
	};

	const loadHits = async () => {
		try {
			const response = await pocketbase
				.collection('anti_cheat_module_hits')
				.getList<HitRow>(1, 50, {
					sort: '-detected_at',
					expand: 'user',
					fetch
				});
			hits = response.items;
		} catch (error) {
			console.error('[ADMIN]: module hits load failed:', error);
			app.toast.error(t('Could not load module hits.'));
		}
	};

	const addEntry = async () => {
		const entryName = name.trim();
		if (!entryName) {
			return;
		}

		isSaving = true;
		try {
			const existing = await pocketbase
				.collection('anti_cheat_module_allowlist')
				.getFirstListItem<AntiCheatModuleAllowlistResponse>(
					`name="${escapeFilterValue(entryName)}"`,
					{ fetch }
				)
				.catch(() => null);

			if (existing) {
				app.toast.error(t('That module is already on the allowlist.'));
				return;
			}

			await pocketbase.collection('anti_cheat_module_allowlist').create(
				{
					name: entryName,
					label: label.trim() || entryName,
					enabled
				},
				{ fetch }
			);
			name = '';
			label = '';
			enabled = true;
			app.toast.success(t('Module allowlisted.'));
			await loadAllowlist();
		} catch (error) {
			console.error('[ADMIN]: module allowlist create failed:', error);
			app.toast.error(t('Could not save module allowlist entry.'));
		} finally {
			isSaving = false;
		}
	};

	const toggleEnabled = async (entry: AntiCheatModuleAllowlistResponse) => {
		togglingId = entry.id;
		try {
			await pocketbase
				.collection('anti_cheat_module_allowlist')
				.update(entry.id, { enabled: entry.enabled === false }, { fetch });
			await loadAllowlist();
		} catch (error) {
			console.error('[ADMIN]: module allowlist update failed:', error);
			app.toast.error(t('Could not save module allowlist entry.'));
		} finally {
			togglingId = null;
		}
	};

	const removeEntry = async (entry: AntiCheatModuleAllowlistResponse) => {
		const confirmed = await confirm(
			t('Remove {name} from the module allowlist?', { name: entry.name }),
			{
				okLabel: t('Delete'),
				cancelLabel: t('Cancel'),
				kind: 'warning'
			}
		);
		if (!confirmed) {
			return;
		}

		deletingId = entry.id;
		try {
			await pocketbase.collection('anti_cheat_module_allowlist').delete(entry.id, { fetch });
			app.toast.success(t('Module removed from allowlist.'));
			await loadAllowlist();
		} catch (error) {
			console.error('[ADMIN]: module allowlist delete failed:', error);
			app.toast.error(t('Could not delete module allowlist entry.'));
		} finally {
			deletingId = null;
		}
	};

	const allowlistHit = async (hit: HitRow) => {
		allowingId = hit.id;
		const entryName = hit.module_name.trim();
		try {
			const existing = await pocketbase
				.collection('anti_cheat_module_allowlist')
				.getFirstListItem<AntiCheatModuleAllowlistResponse>(
					`name="${escapeFilterValue(entryName)}"`,
					{ fetch }
				)
				.catch(() => null);

			if (existing) {
				if (existing.enabled === false) {
					await pocketbase
						.collection('anti_cheat_module_allowlist')
						.update(existing.id, { enabled: true }, { fetch });
				}
				app.toast.success(t('Module allowlisted.'));
				await loadAllowlist();
				return;
			}

			await pocketbase.collection('anti_cheat_module_allowlist').create(
				{
					name: entryName,
					label: entryName,
					enabled: true
				},
				{ fetch }
			);
			app.toast.success(t('Module allowlisted.'));
			await loadAllowlist();
		} catch (error) {
			console.error('[ADMIN]: promote module hit failed:', error);
			app.toast.error(t('Could not save module allowlist entry.'));
		} finally {
			allowingId = null;
		}
	};
</script>

<Form.Group
	inputId="module-allowlist-name"
	label={t('New allowlist entry')}
	description={t(
		'Add a DLL name or path prefix that fair play should treat as benign inside RelicCOH.exe.'
	)}
>
	<Input
		id="module-allowlist-name"
		bind:value={name}
		placeholder="discord_hook.dll"
		aria-label={t('Module or path')}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void addEntry();
			}
		}}
	/>
	<Input
		bind:value={label}
		placeholder={t('Optional display name')}
		aria-label={t('Label')}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void addEntry();
			}
		}}
	/>
	<Checkbox bind:checked={enabled} label={t('Enabled')} size="sm" />
	{#snippet footer()}
		<Button
			type="button"
			variant="secondary"
			class="w-fit"
			disabled={!canAdd}
			loading={isSaving}
			onclick={() => addEntry()}
		>
			<PlusIcon size={16} />
			{t('Add entry')}
		</Button>
	{/snippet}
</Form.Group>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Module allowlist')}
		</p>
	</div>
	{#snippet cell_name({ row }: { row: AntiCheatModuleAllowlistResponse })}
		<span class="block truncate leading-none">{row.name}</span>
	{/snippet}
	{#snippet cell_label({ row }: { row: AntiCheatModuleAllowlistResponse })}
		<span class="block truncate leading-none">{row.label || '—'}</span>
	{/snippet}
	{#snippet cell_actions({ row }: { row: AntiCheatModuleAllowlistResponse })}
		<div class="flex w-full items-center justify-end gap-2">
			<Badge variant={row.enabled === false ? 'default' : 'success'}>
				{row.enabled === false ? t('Off') : t('On')}
			</Badge>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				loading={togglingId === row.id}
				onclick={() => toggleEnabled(row)}
			>
				{row.enabled === false ? t('Enable') : t('Disable')}
			</Button>
			<Button
				type="button"
				size="sm"
				variant="destructive"
				loading={deletingId === row.id}
				onclick={() => removeEntry(row)}
			>
				{t('Delete')}
			</Button>
		</div>
	{/snippet}
	<DataTable
		data={allowlist}
		columns={allowlistColumns}
		rowKey={(entry) => entry.id}
		empty={t('No module allowlist entries yet.')}
		class="rounded-none border-0"
		cells={{
			name: cell_name,
			label: cell_label,
			actions: cell_actions
		}}
	/>
</section>

<section>
	<div class="border-secondary-800 border-t border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Module hits')}
		</p>
	</div>
	{#snippet cell_user({ row }: { row: HitRow })}
		{#if row.expand?.user}
			<User.Root user={row.expand.user}>
				<User.Name />
			</User.Root>
		{:else}
			<span class="block truncate leading-none">{userLabel(row)}</span>
		{/if}
	{/snippet}
	{#snippet cell_module({ row }: { row: HitRow })}
		<span class="block truncate leading-none">{row.module_name}</span>
	{/snippet}
	{#snippet cell_path({ row }: { row: HitRow })}
		<span class="block truncate leading-none" title={row.module_path}>{row.module_path}</span>
	{/snippet}
	{#snippet cell_session({ row }: { row: HitRow })}
		<span class="leading-none">{row.session_id ?? '—'}</span>
	{/snippet}
	{#snippet cell_hit_actions({ row }: { row: HitRow })}
		<div class="flex w-full items-center justify-end gap-3">
			<span class="text-secondary-500 text-sm leading-none tabular-nums">
				{dayjs(row.detected_at || row.created).format('D MMM YYYY HH:mm')}
			</span>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				loading={allowingId === row.id}
				onclick={() => allowlistHit(row)}
			>
				{t('Allowlist')}
			</Button>
		</div>
	{/snippet}
	<DataTable
		data={hits}
		columns={hitColumns}
		rowKey={(hit) => hit.id}
		empty={t('No module hits yet.')}
		class="rounded-none border-0"
		cells={{
			user: cell_user,
			module: cell_module,
			path: cell_path,
			session: cell_session,
			actions: cell_hit_actions
		}}
	/>
</section>
