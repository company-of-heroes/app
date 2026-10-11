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
	import { getModeLabel, getRaceLabel } from '@company-of-heroes/ui/format/player-format';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Form from '$lib/components/ui/form';
	import { Checkbox, FileDropzone, Input, Select, Textarea } from '$lib/components/ui/input';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { surfacePanel } from '$lib/components/ui/variants';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';
	import { api, unwrapApi } from '$core/api';
	import { useI18n } from '$lib/i18n';
	import { tooltip } from '$lib/attachments';

	type ConditionRow = {
		key: number;
		metric: Reward.RewardMetric;
		threshold: number | string;
		raceId: string;
		matchtypeId: string;
		ranked: string;
		map: string;
		minMinutes: number | string;
		maxMinutes: number | string;
		pro: boolean;
		minAvgElo: number | string;
	};

	const ANY = 'any';
	const { t } = useI18n();

	const columns: ColumnDef<RewardRecord>[] = [
		{ id: 'image', header: '', width: 'w-2/24' },
		{ id: 'title', header: t('Title'), width: 'w-7/24', class: 'font-medium' },
		{ id: 'conditions', header: t('Conditions'), width: 'w-8/24', class: 'text-sm' },
		{ id: 'enabled', header: t('Enabled'), width: 'w-3/24' },
		{ id: 'actions', header: '', width: 'w-4/24', class: 'justify-end' }
	];

	const metricItems = Reward.REWARD_METRICS.map((metric) => ({
		value: metric,
		label: t(Reward.REWARD_METRIC_CATALOG[metric].label)
	}));
	const raceItems = [
		{ value: ANY, label: t('Any faction') },
		...Reward.REWARD_RACE_IDS.map((id) => ({ value: String(id), label: getRaceLabel(id) }))
	];
	const modeItems = [
		{ value: ANY, label: t('Any mode') },
		...Reward.REWARD_MATCHTYPE_IDS.map((id) => ({ value: String(id), label: getModeLabel(id) }))
	];
	const rankedItems = [
		{ value: ANY, label: t('Ranked and unranked') },
		{ value: 'true', label: t('Ranked') },
		{ value: 'false', label: t('Unranked') }
	];

	let mapItems = $state.raw([{ value: ANY, label: t('Any map') }]);
	let rewards = $state.raw<RewardRecord[]>([]);
	let editingId = $state<string | null>(null);
	let title = $state('');
	let description = $state('');
	let enabled = $state(true);
	let secret = $state(false);
	let sort = $state<number | string>(0);
	let conditions = $state<ConditionRow[]>([]);
	let image = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let existingImage = $state<string | null>(null);
	let ribbon = $state<string | null>(null);
	let isSaving = $state(false);
	let deletingId = $state<string | null>(null);
	let nextKey = 0;

	const usedRibbons = $derived(
		rewards.flatMap((reward) => (reward.id !== editingId && reward.ribbon ? [reward.ribbon] : []))
	);
	const parsedConditions = $derived(conditions.map(toCondition));
	const conditionsValid = $derived(rewardConditionsSchema.safeParse(parsedConditions).success);
	const conditionErrors = $derived(parsedConditions.map(conditionError));
	const hasConditionErrors = $derived(conditionErrors.some(Boolean));
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

	function newRow(metric: Reward.RewardMetric = 'matches_played'): ConditionRow {
		return {
			key: nextKey++,
			metric,
			threshold: 10,
			raceId: ANY,
			matchtypeId: ANY,
			ranked: ANY,
			map: ANY,
			minMinutes: '',
			maxMinutes: '',
			pro: false,
			minAvgElo: ''
		};
	}

	function supports(row: ConditionRow, filter: Reward.RewardFilterKey) {
		return Reward.REWARD_METRIC_CATALOG[row.metric].filters.includes(filter);
	}

	function isBoolean(row: ConditionRow) {
		return Boolean(Reward.REWARD_METRIC_CATALOG[row.metric].boolean);
	}

	/** A filled-in number field, or undefined when left empty. */
	function optionalNumber(value: number | string): number | undefined {
		return value === '' || value === null ? undefined : Math.round(Number(value));
	}

	/** Some metrics only exist for a few modes (ladder rank: automatch 1v1 to 4v4). */
	function allowsMode(row: ConditionRow, value: string) {
		const allowed = Reward.REWARD_METRIC_CATALOG[row.metric].matchtypeIds;
		return value === ANY || !allowed || allowed.includes(Number(value));
	}

	function modeItemsFor(row: ConditionRow) {
		return modeItems.filter((item) => allowsMode(row, item.value));
	}

	function toCondition(row: ConditionRow): Reward.RewardCondition {
		const filter: Reward.RewardConditionFilter = {};
		if (supports(row, 'raceId') && row.raceId !== ANY) {
			filter.raceId = Number(row.raceId);
		}

		if (
			supports(row, 'matchtypeId') &&
			row.matchtypeId !== ANY &&
			allowsMode(row, row.matchtypeId)
		) {
			filter.matchtypeId = Number(row.matchtypeId);
		}

		if (supports(row, 'ranked') && row.ranked !== ANY) {
			filter.ranked = row.ranked === 'true';
		}

		if (supports(row, 'map') && row.map !== ANY) {
			filter.map = row.map;
		}

		if (supports(row, 'minMinutes') && optionalNumber(row.minMinutes) !== undefined) {
			filter.minMinutes = optionalNumber(row.minMinutes);
		}

		if (supports(row, 'maxMinutes') && optionalNumber(row.maxMinutes) !== undefined) {
			filter.maxMinutes = optionalNumber(row.maxMinutes);
		}

		if (supports(row, 'pro') && row.pro) {
			filter.pro = true;
		}

		if (supports(row, 'minAvgElo') && optionalNumber(row.minAvgElo) !== undefined) {
			filter.minAvgElo = optionalNumber(row.minAvgElo);
		}

		return {
			metric: row.metric,
			threshold: isBoolean(row) ? 1 : Math.round(Number(row.threshold)) || 0,
			...(Object.keys(filter).length > 0 ? { filter } : {})
		};
	}

	function toRow(condition: Reward.RewardCondition): ConditionRow {
		const filter = condition.filter ?? {};
		return {
			key: nextKey++,
			metric: condition.metric,
			threshold: condition.threshold,
			raceId: filter.raceId !== undefined ? String(filter.raceId) : ANY,
			matchtypeId: filter.matchtypeId !== undefined ? String(filter.matchtypeId) : ANY,
			ranked: filter.ranked !== undefined ? String(filter.ranked) : ANY,
			map: filter.map ?? ANY,
			minMinutes: filter.minMinutes ?? '',
			maxMinutes: filter.maxMinutes ?? '',
			pro: Boolean(filter.pro),
			minAvgElo: filter.minAvgElo ?? ''
		};
	}

	function hasFilters(row: ConditionRow) {
		return Reward.REWARD_METRIC_CATALOG[row.metric].filters.length > 0;
	}

	function unitLabel(row: ConditionRow) {
		const unit = Reward.REWARD_METRIC_CATALOG[row.metric].unit;
		return unit ? t(unit) : null;
	}

	/** Why one condition is not valid, or null. */
	function conditionError(condition: Reward.RewardCondition, index: number): string | null {
		if (condition.threshold < 1) {
			return t('The threshold must be at least 1.');
		}

		const max = Reward.REWARD_METRIC_CATALOG[condition.metric].max;
		if (max !== undefined && condition.threshold > max) {
			return t('The threshold can be at most {max}.', { max });
		}

		const { minMinutes, maxMinutes } = condition.filter ?? {};
		if (minMinutes !== undefined && maxMinutes !== undefined && minMinutes > maxMinutes) {
			return t('The minimum duration must be below the maximum.');
		}

		const key = Reward.rewardConditionKey(condition);
		if (parsedConditions.findIndex((other) => Reward.rewardConditionKey(other) === key) < index) {
			return t('This condition is the same as an earlier one.');
		}

		return null;
	}

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
		conditions = [newRow()];
		image = null;
		existingImage = null;
		ribbon = null;
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
			mapItems = [
				{ value: ANY, label: t('Any map') },
				...maps.map((map) => ({ value: map.map, label: map.name || map.map }))
			];
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
		conditions = (reward.conditions ?? []).map(toRow);
		if (conditions.length === 0) {
			conditions = [newRow()];
		}

		image = null;
		existingImage = api.rewards.imageUrl(reward);
		ribbon = reward.ribbon || null;
		setPreview(null);
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

	function addCondition() {
		const used = new Set(parsedConditions.map(Reward.rewardConditionKey));
		const metric =
			Reward.REWARD_METRICS.find(
				(candidate) => !used.has(Reward.rewardConditionKey({ metric: candidate }))
			) ?? 'matches_played';
		conditions = [...conditions, newRow(metric)];
	}

	function removeCondition(key: number) {
		conditions = conditions.filter((row) => row.key !== key);
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
	<ol class="flex flex-col">
		{#each conditions as row, index (row.key)}
			{@const id = `reward-condition-${row.key}`}
			{@const unit = unitLabel(row)}
			{@const error = conditionErrors[index]}
			<li class="flex flex-col">
				{#if index > 0}
					<div
						class="text-secondary-500 flex items-center gap-3 py-2 text-xs font-semibold tracking-wide uppercase"
					>
						<span class="bg-secondary-800 h-px flex-1"></span>
						{t('and')}
						<span class="bg-secondary-800 h-px flex-1"></span>
					</div>
				{/if}
				<div class={cn(surfacePanel, error && 'border-destructive/60')}>
					<div class="flex flex-wrap items-end gap-3 p-3">
						<span
							class="bg-secondary-800 text-secondary-300 flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
						>
							{index + 1}
						</span>
						<div class="flex min-w-48 flex-1 flex-col gap-1.5">
							<Form.Label class="text-xs">{t('Metric')}</Form.Label>
							<Select
								type="single"
								bind:value={row.metric}
								items={metricItems}
								size="sm"
								aria-label={t('Metric')}
							/>
						</div>
						{#if !isBoolean(row)}
							<div class="flex w-44 flex-col gap-1.5">
								<Form.Label for="{id}-threshold" class="text-xs">{t('At least')}</Form.Label>
								<Input
									id="{id}-threshold"
									type="number"
									min={1}
									max={Reward.REWARD_METRIC_CATALOG[row.metric].max}
									size="sm"
									bind:value={row.threshold}
									trailing={unit ? unitSuffix : undefined}
								/>
								{#snippet unitSuffix()}
									<span class="text-xs">{unit}</span>
								{/snippet}
							</div>
						{/if}
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							class="text-secondary-400 ms-auto mb-0.5"
							disabled={conditions.length <= 1}
							onclick={() => removeCondition(row.key)}
							aria-label={t('Remove condition')}
							{@attach tooltip(t('Remove condition'))}
						>
							<TrashIcon size={16} />
						</Button>
					</div>
					{#if hasFilters(row)}
						<div class="border-secondary-800 border-t p-3">
							<p class="text-secondary-500 mb-2 text-xs font-semibold tracking-wide uppercase">
								{t('Filters')}
							</p>
							<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
								{#if supports(row, 'raceId')}
									<div class="flex flex-col gap-1.5">
										<Form.Label class="text-xs">{t('Faction')}</Form.Label>
										<Select
											type="single"
											bind:value={row.raceId}
											items={raceItems}
											size="sm"
											aria-label={t('Faction')}
										/>
									</div>
								{/if}
								{#if supports(row, 'matchtypeId')}
									<div class="flex flex-col gap-1.5">
										<Form.Label class="text-xs">{t('Mode')}</Form.Label>
										<Select
											type="single"
											bind:value={row.matchtypeId}
											items={modeItemsFor(row)}
											size="sm"
											aria-label={t('Mode')}
										/>
									</div>
								{/if}
								{#if supports(row, 'ranked')}
									<div class="flex flex-col gap-1.5">
										<Form.Label class="text-xs">{t('Ranked')}</Form.Label>
										<Select
											type="single"
											bind:value={row.ranked}
											items={rankedItems}
											size="sm"
											aria-label={t('Ranked')}
										/>
									</div>
								{/if}
								{#if supports(row, 'map')}
									<div class="flex flex-col gap-1.5">
										<Form.Label class="text-xs">{t('Map')}</Form.Label>
										<Select
											type="single"
											bind:value={row.map}
											items={mapItems}
											size="sm"
											aria-label={t('Map')}
										/>
									</div>
								{/if}
								{#if supports(row, 'minMinutes') || supports(row, 'maxMinutes')}
									<div class="flex flex-col gap-1.5">
										<Form.Label for="{id}-min-minutes" class="text-xs">
											{t('Duration (minutes)')}
										</Form.Label>
										<div class="flex items-center gap-2">
											{#if supports(row, 'minMinutes')}
												<Input
													id="{id}-min-minutes"
													type="number"
													min={1}
													size="sm"
													bind:value={row.minMinutes}
													placeholder={t('Min.')}
													aria-label={t('Min. minutes')}
												/>
											{/if}
											{#if supports(row, 'maxMinutes')}
												<span class="text-secondary-500">–</span>
												<Input
													type="number"
													min={1}
													size="sm"
													bind:value={row.maxMinutes}
													placeholder={t('Max.')}
													aria-label={t('Max. minutes')}
												/>
											{/if}
										</div>
									</div>
								{/if}
								{#if supports(row, 'minAvgElo')}
									<div class="flex flex-col gap-1.5">
										<Form.Label for="{id}-min-elo" class="text-xs">
											{t('Min. average ELO')}
										</Form.Label>
										<Input
											id="{id}-min-elo"
											type="number"
											min={0}
											size="sm"
											bind:value={row.minAvgElo}
											placeholder={t('Any')}
										/>
									</div>
								{/if}
								{#if supports(row, 'pro')}
									<div class="flex items-end pb-1.5">
										<Checkbox bind:checked={row.pro} label={t('Pro lobbies only')} size="sm" />
									</div>
								{/if}
							</div>
						</div>
					{/if}
					{#if error}
						<p class="border-secondary-800 text-destructive border-t px-3 py-2 text-sm">{error}</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
	<div class="flex flex-wrap items-center gap-3">
		<Button
			type="button"
			size="sm"
			variant="secondary"
			class="w-fit"
			disabled={conditions.length >= Reward.REWARD_CONDITIONS_MAX}
			onclick={addCondition}
		>
			<PlusIcon size={16} />
			{t('Add condition')}
		</Button>
		<span class="text-secondary-500 text-sm">
			{t('{count} of {max} conditions', {
				count: conditions.length,
				max: Reward.REWARD_CONDITIONS_MAX
			})}
		</span>
		{#if !conditionsValid && !hasConditionErrors}
			<span class="text-destructive text-sm">
				{t(
					'Each condition needs a threshold of at least 1, a different metric or filter, and a minimum duration below the maximum.'
				)}
			</span>
		{/if}
	</div>
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
