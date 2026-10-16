<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { interactive } from '$lib/components/ui/variants';
	import { pageTab } from '@company-of-heroes/ui/variants';
	import { MatchRow } from '@company-of-heroes/ui/replay-browse';
	import {
		ListSkeleton as ReplayListSkeleton,
		type CommunityMatch
	} from '@company-of-heroes/ui/replay';
	import { raceFromReplayFaction } from '@company-of-heroes/ui/replay/stats';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import type { ReplaysExpanded } from '$core/app/database/replays';
	import type { ReplayList } from './replay-list.svelte';
	import { app } from '$core/app/context';
	import { resource } from 'runed';
	import { SvelteSet } from 'svelte/reactivity';
	import { listReplayFiles } from '$core/app/features/replay-analyzer/replay-files';
	import { ReplayRenameForm } from '@company-of-heroes/ui/replay';
	import { Badge } from '@company-of-heroes/ui/badge';
	import ReplayDeleteModal from './replay-delete-modal.svelte';
	import { useI18n } from '$lib/i18n';

	interface Props {
		list: ReplayList;
	}

	let { list }: Props = $props();
	const { t } = useI18n();

	let downloadingIds = $state<Record<string, boolean>>({});
	let confirmedLocalIds = $state<Record<string, true>>({});

	/** Row keys (`id:filename`) whose local presence was already checked. */
	const checkedRows = new SvelteSet<string>();

	/** Lowercased names in the playback folder, or null when the folder could not be listed. */
	async function listLocalReplayNames(): Promise<Set<string> | null> {
		if (!app.cohPaths.warningsLog) {
			return new Set();
		}

		try {
			const files = await listReplayFiles(await app.paths.cohPlaybackDir());
			return new Set(files.map((file) => file.name.toLowerCase()));
		} catch {
			return null;
		}
	}

	// Only rows added since the last run (infinite scroll) are checked, against one folder listing.
	const localPresence = resource(
		() => list.replays.map((replay) => `${replay.id}:${replay.filename}`).join('|'),
		async (_key, _previousKey, { data }) => {
			// A refetch or filter change empties the list first: check every row again, so files
			// moved outside the app show up correctly.
			if (list.replays.length === 0) {
				checkedRows.clear();
				return {};
			}

			const fresh = list.replays.filter((row) => !checkedRows.has(`${row.id}:${row.filename}`));
			if (fresh.length === 0) {
				return data ?? {};
			}

			const localNames = await listLocalReplayNames();
			if (!localNames) {
				// Listing failed: leave the rows unchecked instead of marking them missing.
				return data ?? {};
			}

			const presence: Record<string, boolean> = { ...data };
			for (const row of fresh) {
				checkedRows.add(`${row.id}:${row.filename}`);
				presence[row.id] = !!row.filename && localNames.has(row.filename.toLowerCase());
			}

			return presence;
		}
	);

	const localPresentIds = $derived({
		...(localPresence.current ?? {}),
		...confirmedLocalIds
	});

	const highlightedPlayers = $derived(list.filters.players);

	/** A library replay as a list row: roster from the .rec, linked by Steam id. */
	function toRow(replay: ReplaysExpanded): CommunityMatch {
		return {
			id: replay.id,
			kind: 'member',
			map: (replay.mapFilename || '').split(/[/\\]/).pop() || replay.mapName || '',
			title: replay.title === '-' ? '' : replay.title,
			result: null,
			createdAt: replay.gameDate || replay.createdAt,
			isRanked: replay.isRanked,
			likeCount: replay.likeCount ?? 0,
			downloadCount: replay.downloadCount ?? 0,
			commentCount: replay.commentCount ?? 0,
			durationSeconds: replay.durationInSeconds || null,
			players: (replay.players ?? []).map((player) => ({
				playerId: null,
				steamId: player.steamId || null,
				race: raceFromReplayFaction(player.faction || ''),
				profile: { profile_id: 0, alias: player.name || '' }
			}))
		};
	}

	function markLocalPresent(id: string) {
		confirmedLocalIds = { ...confirmedLocalIds, [id]: true };
	}

	function markLocalAbsent(id: string) {
		const { [id]: _removed, ...rest } = confirmedLocalIds;
		confirmedLocalIds = rest;
		if (localPresence.current?.[id]) {
			localPresence.mutate({ ...localPresence.current, [id]: false });
		}
	}

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0]?.isIntersecting) {
				return;
			}

			if (list.isLoading || !list.hasMore) {
				return;
			}

			list.loadMore();
		});

		observer.observe(node);

		return () => {
			observer.disconnect();
		};
	}

	function toggleDurationSort() {
		list.filters.sort.gameDate = '';
		if (list.filters.sort.duration === 'durationInSeconds') {
			list.filters.sort.duration = '-durationInSeconds';
		} else {
			list.filters.sort.duration = 'durationInSeconds';
		}
	}

	function toggleDateSort() {
		list.filters.sort.duration = '';
		if (list.filters.sort.gameDate === 'gameDate') {
			list.filters.sort.gameDate = '-gameDate';
		} else {
			list.filters.sort.gameDate = 'gameDate';
		}
	}

	function openRename(row: ReplaysExpanded) {
		app.modal.create({
			title: t('Rename replay'),
			size: 'sm',
			component: ReplayRenameForm,
			props: {
				initialName: row.title === '-' ? '' : row.title,
				onCancel: () => app.modal.close(),
				onSave: async (name: string) => {
					try {
						const result = await app.database.replays.rename(row.id, name);
						list.patch(row.id, {
							title: result.title,
							file: result.file as ReplaysExpanded['file'],
							filename: result.filename
						});
						markLocalPresent(row.id);
						app.toast.success(t('Replay name updated.'));
						app.modal.close();
					} catch (error) {
						app.toast.error(
							t('Failed to rename replay: {message}', {
								message: error instanceof Error ? error.message : String(error)
							})
						);
					}
				}
			}
		});
		app.modal.open();
	}

	function openDelete(row: ReplaysExpanded) {
		app.modal.create({
			title: t('Delete replay'),
			size: 'md',
			component: ReplayDeleteModal,
			props: {
				title: row.title,
				hasLocal: !!localPresentIds[row.id],
				onCancel: () => app.modal.close(),
				onConfirm: async (mode) => {
					try {
						if (mode === 'local') {
							const removed = await app.database.replays.deleteLocal(row.filename);
							if (!removed) {
								app.toast.error(t('Local replay file was not found.'));
								return;
							}

							markLocalAbsent(row.id);
							app.toast.success(t('Local replay file deleted.'));
						} else {
							try {
								await app.database.replays.deleteLocal(row.filename);
							} catch (error) {
								console.warn('[REPLAYS]: failed to delete local replay', row.filename, error);
							}
							await app.database.replays.delete(row.id);
							list.remove(row.id);
							markLocalAbsent(row.id);
							app.toast.success(t('Replay deleted from library and disk.'));
						}

						app.modal.close();
					} catch (error) {
						app.toast.error(
							t('Failed to delete replay: {message}', { message: (error as Error).message })
						);
					}
				}
			}
		});
		app.modal.open();
	}

	async function downloadReplay(row: ReplaysExpanded) {
		if (downloadingIds[row.id] || localPresentIds[row.id]) {
			return;
		}

		downloadingIds = { ...downloadingIds, [row.id]: true };
		try {
			const result = await app.database.replays.download(row.id);
			list.patch(row.id, {
				file: result.file as ReplaysExpanded['file'],
				filename: result.filename
			});
			markLocalPresent(row.id);
			app.toast.success(t('Replay saved to the Company of Heroes playback folder.'));
		} catch (error) {
			app.toast.error(
				t('Failed to download replay: {message}', {
					message: error instanceof Error ? error.message : String(error)
				})
			);
		} finally {
			downloadingIds = { ...downloadingIds, [row.id]: false };
		}
	}

	async function publishReplay(row: ReplaysExpanded) {
		if (row.visibility === 'member') {
			return;
		}

		try {
			await app.database.replays.publish(row.id);
			list.patch(row.id, { visibility: 'member' } as Partial<ReplaysExpanded>);
			app.toast.success(t('Replay published to Shared Replays.'));
		} catch (error) {
			app.toast.error(
				t('Failed to publish replay: {message}', {
					message: error instanceof Error ? error.message : String(error)
				})
			);
		}
	}
</script>

{#snippet sortChip(label: string, active: boolean, ascending: boolean, onclick: () => void)}
	<button
		type="button"
		class={cn(pageTab, 'h-8 px-3 text-sm')}
		data-state={active ? 'on' : undefined}
		aria-pressed={active}
		{onclick}
	>
		{label}
		{#if active}
			{#if ascending}
				<ArrowUpIcon class="size-3.5" weight="bold" />
			{:else}
				<ArrowDownIcon class="size-3.5" weight="bold" />
			{/if}
		{/if}
	</button>
{/snippet}

{#snippet rowActions(row: ReplaysExpanded)}
	{@const isDownloading = !!downloadingIds[row.id]}
	{@const isLocal = !!localPresentIds[row.id]}
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class={cn(
			interactive,
			'text-secondary-400 hover:text-secondary-100',
			isLocal && 'pointer-events-none cursor-not-allowed opacity-50'
		)}
		loading={isDownloading}
		disabled={isDownloading || isLocal}
		aria-label={isLocal ? t('Replay available locally') : t('Download replay')}
		{@attach tooltip(
			isLocal ? t('Available in playback folder') : t('Download to playback folder')
		)}
		onclick={() => void downloadReplay(row)}
	>
		{#if isLocal && !isDownloading}
			<CheckIcon size={16} />
		{:else if !isDownloading}
			<DownloadIcon size={16} />
		{/if}
	</Button>
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class={cn(
			interactive,
			'text-secondary-400 hover:text-secondary-100',
			row.visibility === 'member' && 'pointer-events-none cursor-not-allowed opacity-50'
		)}
		disabled={row.visibility === 'member'}
		aria-label={row.visibility === 'member' ? t('Published') : t('Publish to Shared Replays')}
		{@attach tooltip(
			row.visibility === 'member' ? t('Already published') : t('Publish to Shared Replays')
		)}
		onclick={() => void publishReplay(row)}
	>
		{#if row.visibility === 'member'}
			<CheckIcon size={16} />
		{:else}
			<UploadSimpleIcon size={16} />
		{/if}
	</Button>
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class={cn(interactive, 'text-secondary-400 hover:text-secondary-100')}
		aria-label={t('Rename replay')}
		{@attach tooltip(t('Rename'))}
		onclick={() => openRename(row)}
	>
		<PencilSimpleIcon size={16} />
	</Button>
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class={cn(interactive, 'text-secondary-400 hover:text-destructive')}
		aria-label={t('Delete replay')}
		{@attach tooltip(t('Delete'))}
		onclick={() => openDelete(row)}
	>
		<TrashIcon size={16} />
	</Button>
{/snippet}

<div
	class="border-secondary-800 flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5"
	role="group"
	aria-label={t('Sort')}
>
	{@render sortChip(
		t('Date'),
		list.filters.sort.duration === '',
		list.filters.sort.gameDate === 'gameDate',
		toggleDateSort
	)}
	{@render sortChip(
		t('Duration'),
		list.filters.sort.duration !== '',
		list.filters.sort.duration === 'durationInSeconds',
		toggleDurationSort
	)}
</div>

{#if list.isLoading && list.replays.length === 0}
	<ReplayListSkeleton rowCount={10} />
{:else}
	<div class="-mb-px">
		{#each list.replays as row (row.id)}
			{@const isLocal = !!localPresentIds[row.id]}
			<MatchRow match={toRow(row)} showEngagement={false} href={`/replays/${row.id}`}>
				{#snippet badges()}
					{#if row.visibility === 'member'}
						<Badge variant="success">{t('Published')}</Badge>
					{/if}
					{#if isLocal}
						<Badge>{t('In playback folder')}</Badge>
					{/if}
				{/snippet}
				{#snippet actions()}
					{@render rowActions(row)}
				{/snippet}
			</MatchRow>
		{/each}
	</div>
	<div
		{@attach viewport}
		class="text-secondary-400 border-secondary-800 border-t px-4 py-3 text-sm"
	>
		{#if list.replays.length > 0}
			{t('Showing {count} replays', { count: list.replays.length })}
			{#if list.isLoading}
				{t('(loading...)')}
			{/if}
		{:else}
			{t('No replays found in your Company of Heroes playback folder.')}
		{/if}
	</div>
{/if}
