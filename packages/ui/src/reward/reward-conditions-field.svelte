<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { surfacePanel } from '@company-of-heroes/ui/variants';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import { tooltip } from '../attachments';
	import { getModeLabel, getRaceLabel } from '../format/player-format';
	import { Button } from '../ui/button';
	import * as Form from '../ui/form';
	import { Checkbox, Input, Select } from '../ui/input';
	import {
		allowsMode,
		CONDITION_ANY,
		supportsFilter,
		type RewardConditionError,
		type RewardConditionRow,
		type RewardConditionsEditor
	} from './conditions-editor.svelte';
	import {
		REWARD_CONDITIONS_MAX,
		REWARD_MATCHTYPE_IDS,
		REWARD_METRIC_CATALOG,
		REWARD_METRICS,
		REWARD_RACE_IDS
	} from './metrics';

	type Props = {
		editor: RewardConditionsEditor;
		/** Raw map key → name, for the map filter. */
		maps?: { value: string; label: string }[];
		/** Prefix for the input ids, unique per form. */
		idPrefix?: string;
		/** The host's schema rejects the list; shown when no single row explains why. */
		invalid?: boolean;
	};

	let { editor, maps = [], idPrefix = 'reward-condition', invalid = false }: Props = $props();
	const { t } = useI18n();

	const metricItems = REWARD_METRICS.map((metric) => ({
		value: metric,
		label: t(REWARD_METRIC_CATALOG[metric].label)
	}));
	const raceItems = [
		{ value: CONDITION_ANY, label: t('Any faction') },
		...REWARD_RACE_IDS.map((id) => ({ value: String(id), label: getRaceLabel(id) }))
	];
	const modeItems = [
		{ value: CONDITION_ANY, label: t('Any mode') },
		...REWARD_MATCHTYPE_IDS.map((id) => ({ value: String(id), label: getModeLabel(id) }))
	];
	const rankedItems = [
		{ value: CONDITION_ANY, label: t('Ranked and unranked') },
		{ value: 'true', label: t('Ranked') },
		{ value: 'false', label: t('Unranked') }
	];
	const mapItems = $derived([{ value: CONDITION_ANY, label: t('Any map') }, ...maps]);

	function errorText(error: RewardConditionError): string {
		switch (error.kind) {
			case 'threshold':
				return t('The threshold must be at least 1.');
			case 'max':
				return t('The threshold can be at most {max}.', { max: error.max });
			case 'duration':
				return t('The minimum duration must be below the maximum.');
			case 'duplicate':
				return t('This condition is the same as an earlier one.');
		}
	}

	function unitLabel(row: RewardConditionRow) {
		const unit = REWARD_METRIC_CATALOG[row.metric].unit;
		return unit ? t(unit) : null;
	}
</script>

{#if editor.rows.length > 0}
	<ol class="flex flex-col">
		{#each editor.rows as row, index (row.key)}
			{@const id = `${idPrefix}-${row.key}`}
			{@const unit = unitLabel(row)}
			{@const error = editor.errors[index]}
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
						{#if !REWARD_METRIC_CATALOG[row.metric].boolean}
							<div class="flex w-44 flex-col gap-1.5">
								<Form.Label for="{id}-threshold" class="text-xs">{t('At least')}</Form.Label>
								<Input
									id="{id}-threshold"
									type="number"
									min={1}
									max={REWARD_METRIC_CATALOG[row.metric].max}
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
							disabled={!editor.canRemove}
							onclick={() => editor.remove(row.key)}
							aria-label={t('Remove condition')}
							{@attach tooltip(t('Remove condition'))}
						>
							<TrashIcon size={16} />
						</Button>
					</div>
					{#if REWARD_METRIC_CATALOG[row.metric].filters.length > 0}
						<div class="border-secondary-800 border-t p-3">
							<p class="text-secondary-500 mb-2 text-xs font-semibold tracking-wide uppercase">
								{t('Filters')}
							</p>
							<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
								{#if supportsFilter(row, 'raceId')}
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
								{#if supportsFilter(row, 'matchtypeId')}
									<div class="flex flex-col gap-1.5">
										<Form.Label class="text-xs">{t('Mode')}</Form.Label>
										<Select
											type="single"
											bind:value={row.matchtypeId}
											items={modeItems.filter((item) => allowsMode(row, item.value))}
											size="sm"
											aria-label={t('Mode')}
										/>
									</div>
								{/if}
								{#if supportsFilter(row, 'ranked')}
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
								{#if supportsFilter(row, 'map')}
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
								{#if supportsFilter(row, 'minMinutes') || supportsFilter(row, 'maxMinutes')}
									<div class="flex flex-col gap-1.5">
										<Form.Label for="{id}-min-minutes" class="text-xs">
											{t('Duration (minutes)')}
										</Form.Label>
										<div class="flex items-center gap-2">
											{#if supportsFilter(row, 'minMinutes')}
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
											{#if supportsFilter(row, 'maxMinutes')}
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
								{#if supportsFilter(row, 'minAvgElo')}
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
								{#if supportsFilter(row, 'pro')}
									<div class="flex items-end pb-1.5">
										<Checkbox bind:checked={row.pro} label={t('Pro lobbies only')} size="sm" />
									</div>
								{/if}
							</div>
						</div>
					{/if}
					{#if error}
						<p class="border-secondary-800 text-destructive border-t px-3 py-2 text-sm">
							{errorText(error)}
						</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
{/if}
<div class="flex flex-wrap items-center gap-3">
	<Button
		type="button"
		size="sm"
		variant="secondary"
		class="w-fit"
		disabled={!editor.canAdd}
		onclick={() => editor.add()}
	>
		<PlusIcon size={16} />
		{t('Add condition')}
	</Button>
	<span class="text-secondary-500 text-sm">
		{t('{count} of {max} conditions', {
			count: editor.rows.length,
			max: REWARD_CONDITIONS_MAX
		})}
	</span>
	{#if invalid && !editor.hasErrors}
		<span class="text-destructive text-sm">
			{t(
				'Each condition needs a threshold of at least 1, a different metric or filter, and a minimum duration below the maximum.'
			)}
		</span>
	{/if}
</div>
