<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Dropdown from '$lib/components/ui/dropdown';
	import { app } from '$core/app/context';
	import { setLabelsForSteamId } from '$core/pocketbase/player-label-cache.svelte';
	import {
		assignPlayerLabel,
		labelHex,
		labelsBySteamId,
		listAssignmentsForSteamIds,
		listUserLabels,
		unassignPlayerLabel,
		type PlayerLabelAssignment,
		type UserLabel
	} from '$core/pocketbase/user-labels';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import TagSimpleIcon from 'phosphor-svelte/lib/TagSimpleIcon';

	type Props = {
		steamId: string;
		profileId: number;
		alias?: string;
		class?: string;
	};

	let { steamId, profileId, alias, class: className }: Props = $props();
	const { t } = useI18n();

	let labels = $state.raw<UserLabel[]>([]);
	let assignments = $state.raw<PlayerLabelAssignment[]>([]);
	let togglingId = $state<string | null>(null);

	watch(
		() => (app.account.isStaff ? steamId : ''),
		(id) => {
			if (id) {
				void load();
			}
		}
	);

	function recordId(value: unknown) {
		if (!value) {
			return '';
		}

		if (typeof value === 'object' && 'id' in value) {
			return String((value as { id: string }).id);
		}

		return String(value);
	}

	const assignmentFor = (labelId: string) =>
		assignments.find((row) => recordId(row.label) === labelId);

	async function load() {
		try {
			const [catalog, rows] = await Promise.all([
				listUserLabels(),
				listAssignmentsForSteamIds([steamId])
			]);
			labels = catalog;
			assignments = rows;
			setLabelsForSteamId(steamId, labelsBySteamId(rows)[steamId] ?? []);
		} catch (error) {
			console.error('[PLAYER]: label editor load failed:', error);
			app.toast.error(t('Could not load player labels.'));
		}
	}

	const toggleLabel = async (label: UserLabel) => {
		togglingId = label.id;
		try {
			const existing = assignmentFor(label.id);
			if (existing) {
				await unassignPlayerLabel(existing.id);
			} else {
				await assignPlayerLabel({
					steamId,
					profileId,
					alias,
					labelId: label.id
				});
			}

			await load();
		} catch (error) {
			console.error('[PLAYER]: label toggle failed:', error);
			app.toast.error(t('Could not update labels.'));
		} finally {
			togglingId = null;
		}
	};
</script>

{#if app.account.isStaff}
	<Dropdown.Root>
		{#snippet trigger({ props })}
			<Button
				{...props}
				type="button"
				variant="ghost"
				size="sm"
				class={cn('text-secondary-400 h-8 px-2.5 hover:text-white', className)}
			>
				<TagSimpleIcon size={16} />
				{t('Edit labels')}
			</Button>
		{/snippet}
		{#if labels.length === 0}
			<div class="text-secondary-400 px-4 py-2.5 text-sm">{t('No labels yet.')}</div>
		{:else}
			{#each labels as label (label.id)}
				<Dropdown.Item
					class="flex items-center gap-2"
					disabled={togglingId === label.id}
					onclick={() => toggleLabel(label)}
				>
					<span class="flex h-4 w-4 shrink-0 items-center justify-center">
						{#if assignmentFor(label.id)}
							<CheckIcon class="size-4" weight="bold" />
						{/if}
					</span>
					<Badge hex={labelHex(label.color)}>{label.name}</Badge>
				</Dropdown.Item>
			{/each}
		{/if}
	</Dropdown.Root>
{/if}
