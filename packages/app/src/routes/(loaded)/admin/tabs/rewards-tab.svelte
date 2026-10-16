<script lang="ts">
	import { confirmation } from '$lib/components/ui/modal';
	import { watch } from 'runed';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import {
		REWARD_IMAGE_MAX_BYTES,
		REWARD_IMAGE_SIZE,
		rewardConditionsSchema,
		type RewardRecord
	} from '@company-of-heroes/api';
	import * as Reward from '@company-of-heroes/ui/reward';
	import { Alert } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Form from '$lib/components/ui/form';
	import { Checkbox, FileDropzone, Input, Textarea } from '$lib/components/ui/input';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { app } from '$core/app/context';
	import { api, unwrapApi } from '$core/api';
	import { useI18n } from '$lib/i18n';
	import { tooltip } from '$lib/attachments';

	const { t } = useI18n();

	const columns: ColumnDef<RewardRecord>[] = [
		{ id: 'image', header: '', width: 'w-2/24' },
		{ id: 'title', header: t('Title'), width: 'w-7/24', class: 'font-medium' },
		{ id: 'conditions', header: t('Conditions'), width: 'w-8/24', class: 'text-sm' },
		{ id: 'enabled', header: t('Enabled'), width: 'w-3/24' },
		{ id: 'actions', header: '', width: 'w-4/24', class: 'justify-end' }
	];

	let mapItems = $state.raw<{ value: string; label: string }[]>([]);
	let rewards = $state.raw<RewardRecord[]>([]);
	let editingId = $state<string | null>(null);
	let title = $state('');
	let description = $state('');
	let enabled = $state(true);
	let secret = $state(false);
	let sort = $state<number | string>(0);
	const conditions = new Reward.RewardConditionsEditor();
	let image = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let existingImage = $state<string | null>(null);
	let ribbon = $state<string | null>(null);
	/** Stored conditions of the edited reward when they are not valid, as JSON. */
	let invalidStoredConditions = $state<string | null>(null);
	let isSaving = $state(false);
	let deletingId = $state<string | null>(null);

	const usedRibbons = $derived(
		rewards.flatMap((reward) => (reward.id !== editingId && reward.ribbon ? [reward.ribbon] : []))
	);
	const parsedConditions = $derived(conditions.conditions);
	const conditionsValid = $derived(rewardConditionsSchema.safeParse(parsedConditions).success);
	const canSave = $derived(
		title.trim().length > 0 &&
			conditionsValid &&
			(Boolean(image) || Boolean(ribbon) || Boolean(existingImage)) &&
			!isSaving
	);
	const preview = $derived<Reward.RewardView>({
		id: 'preview',
		title: title.trim() || t('Reward title'),
		description: description.trim(),
		imageUrl: imagePreview ?? existingImage,
		ribbon,
		conditions: parsedConditions,
		secret: false,
		sort: 0,
		unlockedAt: null,
		progress: {
			overall: 0,
			conditions: parsedConditions.map((condition) => ({ ...condition, value: 0 }))
		}
	});

	resetForm();

	let rewardsLoading = $state(false);

	watch(
		() => app.account.isAdmin,
		(isAdmin) => {
			if (isAdmin) {
				void loadRewards();
				void loadMaps();
			}
		}
	);

	function setPreview(url: string | null) {
		if (imagePreview) {
			URL.revokeObjectURL(imagePreview);
		}

		imagePreview = url;
	}

	function resetForm() {
		editingId = null;
		title = '';
		description = '';
		enabled = true;
		secret = false;
		sort = rewards.reduce((max, reward) => Math.max(max, reward.sort ?? 0), -1) + 1;
		conditions.reset();
		image = null;
		existingImage = null;
		ribbon = null;
		invalidStoredConditions = null;
		setPreview(null);
	}

	async function loadRewards() {
		rewardsLoading = true;
		try {
			rewards = await unwrapApi(api.rewards.listAll());
		} catch (error) {
			console.error('[ADMIN]: rewards load failed:', error);
			app.toast.error(t('Could not load rewards.'));
		} finally {
			rewardsLoading = false;
		}
	}

	async function loadMaps() {
		try {
			const maps = await unwrapApi(api.replays.getMaps());
			mapItems = maps.map((map) => ({ value: map.map, label: map.name || map.map }));
		} catch (error) {
			console.error('[ADMIN]: reward maps load failed:', error);
		}
	}

	function startEdit(reward: RewardRecord) {
		editingId = reward.id;
		title = reward.title;
		description = reward.description ?? '';
		enabled = reward.enabled !== false;
		secret = Boolean(reward.secret);
		sort = reward.sort ?? 0;
		conditions.load(reward.conditions);
		invalidStoredConditions = reward.conditions ? null : storedValue(reward.rawConditions);
		if (!reward.conditions) {
			// No silent default: the admin sets a threshold before the reward can be saved.
			conditions.rows = conditions.rows.map((row) => ({ ...row, threshold: '' }));
		}

		image = null;
		existingImage = api.rewards.imageUrl(reward);
		ribbon = reward.ribbon || null;
		setPreview(null);
	}

	function storedValue(raw: unknown): string {
		try {
			return JSON.stringify(raw) ?? String(raw);
		} catch {
			return String(raw);
		}
	}

	async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
		try {
			const bitmap = await createImageBitmap(file);
			const size = { width: bitmap.width, height: bitmap.height };
			bitmap.close();
			return size;
		} catch {
			return null;
		}
	}

	async function pickImage(file: File | null) {
		if (!file) {
			image = null;
			setPreview(null);
			return;
		}

		if (file.size > REWARD_IMAGE_MAX_BYTES) {
			app.toast.error(t('Image must be 256 KB or smaller.'));
			return;
		}

		const size = await imageSize(file);
		if (!size) {
			app.toast.error(t('Image must be a png, jpeg, or webp file.'));
			return;
		}

		if (size.width !== size.height) {
			app.toast.error(t('Image must be square ({size}x{size} px).', { size: REWARD_IMAGE_SIZE }));
			return;
		}

		if (size.width !== REWARD_IMAGE_SIZE) {
			app.toast.info(
				t('Image is {width}x{height} px; it is shown at {size}x{size} px.', {
					width: size.width,
					height: size.height,
					size: REWARD_IMAGE_SIZE
				})
			);
		}

		image = file;
		setPreview(URL.createObjectURL(file));
	}

	async function save() {
		if (!canSave) {
			return;
		}

		const input = {
			title,
			description,
			ribbon,
			conditions: parsedConditions,
			enabled,
			secret,
			sort: Number(sort) || 0
		};
		isSaving = true;
		try {
			if (editingId) {
				await unwrapApi(api.rewards.update(editingId, input, image));
				app.toast.success(t('Reward updated.'));
			} else {
				await unwrapApi(api.rewards.create(input, image));
				app.toast.success(t('Reward created.'));
			}

			await loadRewards();
			resetForm();
		} catch (error) {
			console.error('[ADMIN]: reward save failed:', error);
			app.toast.error(error instanceof Error ? t(error.message) : t('Could not save the reward.'));
		} finally {
			isSaving = false;
		}
	}

	async function remove(reward: RewardRecord) {
		const confirmed = await confirmation.ask(
			t(
				'Delete {title}? Everyone who unlocked it loses it. Disable the reward instead to keep existing unlocks.',
				{ title: reward.title }
			),
			{ confirm: t('Delete'), cancel: t('Cancel'), danger: true }
		);
		if (!confirmed) {
			return;
		}

		deletingId = reward.id;
		try {
			await unwrapApi(api.rewards.remove(reward.id));
			if (editingId === reward.id) {
				resetForm();
			}

			app.toast.success(t('Reward deleted.'));
			await loadRewards();
		} catch (error) {
			console.error('[ADMIN]: reward delete failed:', error);
			app.toast.error(t('Could not delete the reward.'));
		} finally {
			deletingId = null;
		}
	}
</script>

<Form.Group
	layout="stacked"
	label={editingId ? t('Edit reward') : t('New reward')}
	description={t(
		'Players unlock a reward once they meet every condition. Unlocks are checked every minute and include past matches.'
	)}
>
	<Input bind:value={title} maxlength={80} placeholder={t('Title')} aria-label={t('Title')} />
	<Textarea
		bind:value={description}
		maxlength={300}
		rows={3}
		placeholder={t('Description')}
		aria-label={t('Description')}
	/>
	<FileDropzone
		id="reward-image"
		accept="image/png,image/jpeg,image/webp"
		label={t('Image ({size}x{size} px, png, jpeg or webp, max 256 KB)', {
			size: REWARD_IMAGE_SIZE
		})}
		fileName={image?.name ?? (existingImage ? t('Current image') : null)}
		dropLabel={t('Drop an image here')}
		browseLabel={t('or click to browse')}
		changeFileLabel={t('Change image')}
		onFileChange={(file) => void pickImage(file)}
	/>
	<div class="flex flex-col gap-2">
		<p class="text-secondary-300 text-sm">{t('Or pick a ribbon instead of an image')}</p>
		<Reward.RibbonField bind:value={ribbon} used={usedRibbons} />
	</div>
</Form.Group>

<Form.Group
	layout="stacked"
	wide
	label={t('Conditions')}
	description={t(
		'All conditions must be met. Match conditions count finished, non-Skirmish matches.'
	)}
>
	{#if invalidStoredConditions !== null}
		<Alert variant="warning" size="sm" class="flex flex-col gap-1">
			<span>
				{t(
					'The stored conditions of this reward are not valid. Set its conditions again before saving.'
				)}
			</span>
			<code class="text-secondary-300 text-xs break-all select-text">
				{t('Stored value: {value}', { value: invalidStoredConditions })}
			</code>
		</Alert>
	{/if}
	<Reward.ConditionsField editor={conditions} maps={mapItems} invalid={!conditionsValid} />
</Form.Group>

<Form.Group layout="stacked" label={t('Preview')}>
	<div class="flex items-center gap-1.5">
		<Reward.Icon reward={{ ...preview, unlockedAt: new Date().toISOString() }} />
		<Reward.Icon reward={preview} />
		<span class="text-secondary-400 ml-2 text-sm">
			{t('Unlocked and locked, as shown under the bio. Hover for the details.')}
		</span>
	</div>
	<div class="flex w-full min-w-0 flex-wrap items-center gap-4">
		<Checkbox bind:checked={enabled} label={t('Enabled')} size="sm" />
		<Checkbox bind:checked={secret} label={t('Secret until unlocked')} size="sm" />
		<Input
			type="number"
			min={0}
			class="w-24 flex-none"
			bind:value={sort}
			aria-label={t('Sort order')}
			{@attach tooltip(t('Sort order'))}
		/>
		<Button
			type="button"
			variant="secondary"
			class="w-fit shrink-0"
			disabled={!canSave}
			loading={isSaving}
			onclick={() => save()}
		>
			{#if editingId}
				<PencilSimpleIcon size={16} />
				{t('Save')}
			{:else}
				<PlusIcon size={16} />
				{t('Add')}
			{/if}
		</Button>
		{#if editingId}
			<Button type="button" variant="secondary" class="w-fit shrink-0" onclick={resetForm}>
				<XIcon size={16} />
				{t('Cancel')}
			</Button>
		{/if}
	</div>
</Form.Group>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">{t('Rewards')}</p>
	</div>
	{#snippet cell_image({ row }: { row: RewardRecord })}
		{@const src = api.rewards.imageUrl(row)}
		{#if row.ribbon}
			<Reward.Icon
				reward={{
					id: row.id,
					title: row.title,
					description: '',
					imageUrl: src,
					ribbon: row.ribbon,
					conditions: [],
					secret: false,
					sort: 0,
					// Shown as unlocked: the table shows the design, not anyone's progress.
					unlockedAt: row.updated
				}}
				class="h-4 w-14"
			/>
		{:else if src}
			<img {src} alt="" width="40" height="40" class="size-10 rounded object-cover" />
		{:else}
			<TrophyIcon size={24} class="text-secondary-600" />
		{/if}
	{/snippet}
	{#snippet cell_title({ row }: { row: RewardRecord })}
		<span class="flex min-w-0 items-center gap-2">
			<span class="truncate">{row.title}</span>
			{#if row.secret}
				<Badge variant="default">{t('Secret')}</Badge>
			{/if}
		</span>
	{/snippet}
	{#snippet cell_conditions({ row }: { row: RewardRecord })}
		{#if row.conditions}
			<span class="text-secondary-400 flex min-w-0 flex-col">
				{#each row.conditions as condition (Reward.rewardConditionKey(condition))}
					<span class="truncate">
						{Reward.formatRewardCondition(condition, t)}
						{#if !Reward.REWARD_METRIC_CATALOG[condition.metric].boolean}
							≥ {condition.threshold}
						{/if}
					</span>
				{/each}
			</span>
		{:else}
			<Badge variant="destructive">{t('Invalid conditions')}</Badge>
		{/if}
	{/snippet}
	{#snippet cell_enabled({ row }: { row: RewardRecord })}
		<Badge variant={row.enabled ? 'success' : 'default'}>
			{row.enabled ? t('On') : t('Off')}
		</Badge>
	{/snippet}
	{#snippet cell_actions({ row }: { row: RewardRecord })}
		<div class="flex gap-2">
			<Button type="button" size="sm" variant="secondary" onclick={() => startEdit(row)}>
				<PencilSimpleIcon size={16} />
				{t('Edit')}
			</Button>
			<Button
				type="button"
				size="sm"
				variant="destructive"
				loading={deletingId === row.id}
				onclick={() => remove(row)}
				aria-label={t('Delete')}
			>
				<TrashIcon size={16} />
			</Button>
		</div>
	{/snippet}
	<DataTable
		data={rewards}
		loading={rewardsLoading && rewards.length === 0}
		{columns}
		rowKey={(entry) => entry.id}
		rowClass={(row) => (editingId === row.id ? 'bg-primary/10' : '')}
		empty={t('No rewards yet.')}
		class="rounded-none border-0"
		cells={{
			image: cell_image,
			title: cell_title,
			conditions: cell_conditions,
			enabled: cell_enabled,
			actions: cell_actions
		}}
	/>
</section>
