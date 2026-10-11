<script lang="ts">
	import { watch } from 'runed';
	import { confirmation } from '$lib/components/ui/modal';
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
		AntiCheatProcessDenylistResponse,
		AntiCheatProcessHitsResponse,
		UsersResponse
	} from '$core/pocketbase/types';
	import dayjs from '$lib/dayjs';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	type HitRow = AntiCheatProcessHitsResponse<{ user?: UsersResponse }>;

	const denylistColumns: ColumnDef<AntiCheatProcessDenylistResponse>[] = [
		{ id: 'name', header: t('Process name'), width: 'w-8/24', class: 'font-medium' },
		{ id: 'label', header: t('Label'), width: 'w-6/24', class: 'text-secondary-400 text-sm' },
		{
			id: 'enabled',
			header: t('Enabled'),
			width: 'w-3/24',
			headerClass: 'text-center',
			class: 'text-center'
		},
		{ id: 'actions', header: '', width: 'w-7/24', class: 'text-right' }
	];

	const hitColumns: ColumnDef<HitRow>[] = [
		{ id: 'user', header: t('Player'), width: 'w-5/24', class: 'font-medium' },
		{ id: 'process', header: t('Process name'), width: 'w-6/24' },
		{
			id: 'session',
			header: t('Session'),
			width: 'w-5/24',
			class: 'text-secondary-500 text-sm tabular-nums'
		},
		{
			id: 'detected',
			header: t('Detected'),
			width: 'w-8/24',
			class: 'text-secondary-500 text-sm tabular-nums'
		}
	];

	let name = $state('');
	let label = $state('');
	let enabled = $state(true);
	let denylist = $state<AntiCheatProcessDenylistResponse[]>([]);
	let hits = $state<HitRow[]>([]);
	let isSaving = $state(false);
	let deletingId = $state<string | null>(null);
	let togglingId = $state<string | null>(null);
	let denylistLoading = $state(false);
	let hitsLoading = $state(false);
	const canAdd = $derived(name.trim().length > 0 && !isSaving);

	const isStaff = $derived(app.account.isStaff);

	watch(
		() => isStaff,
		(enabled) => {
			if (enabled) {
				void loadDenylist();
				void loadHits();
			}
		}
	);

	const userLabel = (hit: HitRow) => {
		const user = hit.expand?.user;
		return user?.name || user?.email || hit.user;
	};

	const loadDenylist = async () => {
		denylistLoading = true;
		try {
			denylist = await pocketbase
				.collection('anti_cheat_process_denylist')
				.getFullList<AntiCheatProcessDenylistResponse>({
					sort: 'name',
					fetch
				});
		} catch (error) {
			console.error('[ADMIN]: denylist load failed:', error);
			app.toast.error(t('Could not load denylist.'));
		} finally {
			denylistLoading = false;
		}
	};

	const loadHits = async () => {
		hitsLoading = true;
		try {
			const response = await pocketbase
				.collection('anti_cheat_process_hits')
				.getList<HitRow>(1, 50, {
					sort: '-detected_at',
					expand: 'user',
					fetch
				});
			hits = response.items;
		} catch (error) {
			console.error('[ADMIN]: process hits load failed:', error);
			app.toast.error(t('Could not load process hits.'));
		} finally {
			hitsLoading = false;
		}
	};

	const addProcess = async () => {
		const processName = name.trim();
		if (!processName) {
			return;
		}

		isSaving = true;
		try {
			await pocketbase.collection('anti_cheat_process_denylist').create(
				{
					name: processName,
					label: label.trim() || processName,
					enabled
				},
				{ fetch }
			);
			name = '';
			label = '';
			enabled = true;
			app.toast.success(t('Process added.'));
			await loadDenylist();
		} catch (error) {
			console.error('[ADMIN]: denylist create failed:', error);
			app.toast.error(t('Could not save process.'));
		} finally {
			isSaving = false;
		}
	};

	const toggleEnabled = async (entry: AntiCheatProcessDenylistResponse) => {
		togglingId = entry.id;
		try {
			await pocketbase
				.collection('anti_cheat_process_denylist')
				.update(entry.id, { enabled: entry.enabled === false }, { fetch });
			await loadDenylist();
		} catch (error) {
			console.error('[ADMIN]: denylist update failed:', error);
			app.toast.error(t('Could not save process.'));
		} finally {
			togglingId = null;
		}
	};

	const removeProcess = async (entry: AntiCheatProcessDenylistResponse) => {
		const confirmed = await confirmation.ask(
			t('Remove {name} from the denylist?', { name: entry.name }),
			{
				confirm: t('Delete'),
				cancel: t('Cancel'),
				danger: true
			}
		);
		if (!confirmed) {
			return;
		}

		deletingId = entry.id;
		try {
			await pocketbase.collection('anti_cheat_process_denylist').delete(entry.id, { fetch });
			app.toast.success(t('Process removed.'));
			await loadDenylist();
		} catch (error) {
			console.error('[ADMIN]: denylist delete failed:', error);
			app.toast.error(t('Could not delete process.'));
		} finally {
			deletingId = null;
		}
	};
</script>

<Form.Group
	inputId="denylist-process-name"
	label={t('New process')}
	description={t('Add a process name to the fair play denylist.')}
>
	<Input
		id="denylist-process-name"
		bind:value={name}
		placeholder="cheatengine"
		aria-label={t('Process name')}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void addProcess();
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
				void addProcess();
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
			onclick={() => addProcess()}
		>
			<PlusIcon size={16} />
			{t('Add process')}
		</Button>
	{/snippet}
</Form.Group>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Processes')}
		</p>
	</div>
	{#snippet cell_name({ row }: { row: AntiCheatProcessDenylistResponse })}
		<span class="truncate">{row.name}</span>
	{/snippet}
	{#snippet cell_label({ row }: { row: AntiCheatProcessDenylistResponse })}
		<span class="truncate">{row.label || '—'}</span>
	{/snippet}
	{#snippet cell_enabled({ row }: { row: AntiCheatProcessDenylistResponse })}
		<div class="flex justify-center">
			<Badge variant={row.enabled === false ? 'default' : 'success'}>
				{row.enabled === false ? t('Off') : t('On')}
			</Badge>
		</div>
	{/snippet}
	{#snippet cell_actions({ row }: { row: AntiCheatProcessDenylistResponse })}
		<div class="flex justify-end gap-2">
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
				onclick={() => removeProcess(row)}
			>
				{t('Delete')}
			</Button>
		</div>
	{/snippet}
	<DataTable
		data={denylist}
		loading={denylistLoading && denylist.length === 0}
		columns={denylistColumns}
		rowKey={(entry) => entry.id}
		empty={t('No denylist entries yet.')}
		class="rounded-none border-0"
		cells={{
			name: cell_name,
			label: cell_label,
			enabled: cell_enabled,
			actions: cell_actions
		}}
	/>
</section>

<section>
	<div class="border-secondary-800 border-t border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Process hits')}
		</p>
	</div>
	{#snippet cell_user({ row }: { row: HitRow })}
		{#if row.expand?.user}
			<User.Root user={row.expand.user}>
				<User.Name />
			</User.Root>
		{:else}
			<span class="block truncate">{userLabel(row)}</span>
		{/if}
	{/snippet}
	{#snippet cell_process({ row }: { row: HitRow })}
		<span class="block truncate">{row.process_name}</span>
	{/snippet}
	{#snippet cell_session({ row }: { row: HitRow })}
		{row.session_id ?? '—'}
	{/snippet}
	{#snippet cell_detected({ row }: { row: HitRow })}
		{dayjs(row.detected_at || row.created).format('D MMM YYYY HH:mm')}
	{/snippet}
	<DataTable
		data={hits}
		loading={hitsLoading && hits.length === 0}
		columns={hitColumns}
		rowKey={(hit) => hit.id}
		empty={t('No process hits yet.')}
		class="rounded-none border-0"
		cells={{
			user: cell_user,
			process: cell_process,
			session: cell_session,
			detected: cell_detected
		}}
	/>
</section>
