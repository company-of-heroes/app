<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Checkbox, Input, Select } from '$lib/components/ui/input';
	import * as Form from '$lib/components/ui/form';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import {
		listReputationTypes,
		REPUTATION_TRIGGER_CATALOG,
		type ReputationType
	} from '$core/pocketbase/reputation';
	import type { Create, Update } from '$core/pocketbase/types';
	import { ClientResponseError } from 'pocketbase';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';

	const { t } = useI18n();

	const columns: ColumnDef<ReputationType>[] = [
		{ id: 'name', header: t('Displayname'), width: 'w-8/24', class: 'font-medium' },
		{ id: 'trigger', header: t('Trigger'), width: 'w-8/24', class: 'text-secondary-400 text-sm' },
		{
			id: 'score',
			header: t('Score'),
			width: 'w-2/24',
			class: 'tabular-nums'
		},
		{
			id: 'enabled',
			header: t('Enabled'),
			width: 'w-3/24'
		},
		{ id: 'actions', header: '', width: 'w-3/24', class: 'justify-end' }
	];

	let types = $state.raw<ReputationType[]>([]);
	let isSaving = $state(false);
	let editingId = $state<string | null>(null);
	let name = $state('');
	let score = $state<number | string>(0);
	let enabled = $state(true);
	let trigger = $state('');
	const previewName = $derived(name.trim());
	const canSave = $derived(Boolean(trigger) && previewName.length > 0 && !isSaving);
	const typeByTrigger = $derived.by(() => {
		const map: Record<string, ReputationType> = {};
		for (const type of types) {
			if (!map[type.trigger]) {
				map[type.trigger] = type;
			}
		}

		return map;
	});
	const triggerItems = $derived(
		REPUTATION_TRIGGER_CATALOG.filter((item) => {
			const existing = typeByTrigger[item.trigger];
			return !existing || existing.id === editingId;
		}).map((item) => {
			const existing = typeByTrigger[item.trigger];
			const label = existing?.name ?? item.name;
			return {
				value: item.trigger,
				label: `${label} (${item.trigger})`
			};
		})
	);

	let typesLoading = $state(false);

	watch(
		() => app.account.isAdmin,
		(isAdmin) => {
			if (isAdmin) {
				void loadTypes();
			}
		}
	);

	watch(
		() => trigger,
		(value) => {
			if (!value) {
				return;
			}

			const type = typeByTrigger[value];
			if (type) {
				editingId = type.id;
				name = type.name;
				score = type.score ?? 0;
				enabled = type.enabled !== false;
				return;
			}

			const catalog = REPUTATION_TRIGGER_CATALOG.find((item) => item.trigger === value);
			editingId = null;
			name = catalog?.name ?? '';
			score = catalog?.score ?? 0;
			enabled = true;
		}
	);

	function resetForm() {
		editingId = null;
		name = '';
		score = 0;
		enabled = true;
		trigger = '';
	}

	function nextSort() {
		return types.reduce((max, type) => Math.max(max, type.sort ?? 0), -1) + 1;
	}

	function isDuplicateTrigger(value: string, ignoreId: string | null) {
		return types.some((row) => row.trigger === value && row.id !== ignoreId);
	}

	async function loadTypes() {
		typesLoading = true;
		try {
			types = await listReputationTypes();
		} catch (error) {
			console.error('[ADMIN]: reputation types load failed:', error);
			app.toast.error(t('Could not load reputation types.'));
		} finally {
			typesLoading = false;
		}
	}

	const startEdit = (type: ReputationType) => {
		editingId = type.id;
		trigger = type.trigger;
	};

	const saveType = async () => {
		if (!trigger || !previewName) {
			return;
		}

		if (isDuplicateTrigger(trigger, editingId)) {
			app.toast.error(t('This trigger is already in use.'));
			return;
		}

		isSaving = true;
		try {
			if (editingId) {
				const data: Update<'reputation_types'> = {
					name: previewName,
					score: Number(score) || 0,
					enabled
				};
				await pocketbase.collection('reputation_types').update(editingId, data, { fetch });
				app.toast.success(t('Reputation type updated.'));
			} else {
				const data: Create<'reputation_types'> = {
					trigger: trigger as ReputationType['trigger'],
					name: previewName,
					score: Number(score) || 0,
					enabled,
					sort: nextSort()
				};
				await pocketbase.collection('reputation_types').create(data, { fetch });
				app.toast.success(t('Reputation type created.'));
			}

			resetForm();
			await loadTypes();
		} catch (error) {
			console.error('[ADMIN]: reputation type update failed:', error);
			const text =
				error instanceof ClientResponseError
					? JSON.stringify(error.response)
					: error instanceof Error
						? error.message
						: '';
			app.toast.error(
				/unique|already in use/i.test(text)
					? t('This trigger is already in use.')
					: t('Could not save reputation type.')
			);
		} finally {
			isSaving = false;
		}
	};
</script>

<Form.Group
	layout="stacked"
	label={t('Reputation types')}
	description={t(
		'Each trigger can only be used once. Choose one, then set its score. Changes apply to new events only.'
	)}
>
	<Select
		type="single"
		bind:value={trigger}
		items={triggerItems}
		placeholder={t('Select a trigger...')}
		empty={t('No unused triggers.')}
		aria-label={t('Trigger')}
	/>
	<div class="flex w-full min-w-0 flex-wrap items-center gap-3">
		<Input
			id="reputation-type-name"
			class="min-w-40"
			bind:value={name}
			placeholder={t('Displayname')}
			aria-label={t('Displayname')}
			disabled={!trigger}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void saveType();
				}

				if (event.key === 'Escape' && trigger) {
					event.preventDefault();
					resetForm();
				}
			}}
		/>
		<Input
			type="number"
			class="w-36 flex-none"
			bind:value={score}
			aria-label={t('Score')}
			disabled={!trigger}
		/>
		<Checkbox bind:checked={enabled} label={t('Enabled')} size="sm" disabled={!trigger} />
		<Button
			type="button"
			variant="secondary"
			class="w-fit shrink-0"
			disabled={!canSave}
			loading={isSaving}
			onclick={() => saveType()}
		>
			{#if editingId}
				<PencilSimpleIcon size={16} />
				{t('Save')}
			{:else}
				<PlusIcon size={16} />
				{t('Add')}
			{/if}
		</Button>
		{#if trigger}
			<Button type="button" variant="secondary" class="w-fit shrink-0" onclick={resetForm}>
				<XIcon size={16} />
				{t('Cancel')}
			</Button>
		{/if}
	</div>
</Form.Group>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Reputation')}
		</p>
	</div>
	{#snippet cell_name({ row }: { row: ReputationType })}
		<span class="truncate">{row.name}</span>
	{/snippet}
	{#snippet cell_trigger({ row }: { row: ReputationType })}
		<span class="truncate">{row.trigger}</span>
	{/snippet}
	{#snippet cell_score({ row }: { row: ReputationType })}
		<span class="whitespace-nowrap">{row.score > 0 ? `+${row.score}` : row.score}</span>
	{/snippet}
	{#snippet cell_enabled({ row }: { row: ReputationType })}
		<Badge variant={row.enabled === false ? 'default' : 'success'}>
			{row.enabled === false ? t('Off') : t('On')}
		</Badge>
	{/snippet}
	{#snippet cell_actions({ row }: { row: ReputationType })}
		<Button type="button" size="sm" variant="secondary" onclick={() => startEdit(row)}>
			<PencilSimpleIcon size={16} />
			{t('Edit')}
		</Button>
	{/snippet}
	<DataTable
		data={types}
		loading={typesLoading && types.length === 0}
		{columns}
		rowKey={(entry) => entry.id}
		rowClass={(row) => (editingId === row.id ? 'bg-primary/10' : '')}
		empty={t('No reputation types yet.')}
		class="rounded-none border-0"
		cells={{
			name: cell_name,
			trigger: cell_trigger,
			score: cell_score,
			enabled: cell_enabled,
			actions: cell_actions
		}}
	/>
</section>
