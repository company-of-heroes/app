<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { interactive } from '$lib/components/ui/variants';
	import * as Match from '$lib/components/match';
	import SortAscendingIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import SortDescendingIcon from 'phosphor-svelte/lib/ArrowUpIcon';
	import SortableIcon from 'phosphor-svelte/lib/ArrowsDownUpIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import type { ReplaysExpanded } from '$core/app/database/replays';
	import type { ReplayList } from './replay-list.svelte';
	import { app } from '$core/app/context';
	import { resource } from 'runed';
	import ReplayRenameModal from './replay-rename-modal.svelte';
	import ReplayDeleteModal from './replay-delete-modal.svelte';
	import { useI18n } from '$lib/i18n';

	interface Props {
		list: ReplayList;
	}

	let { list }: Props = $props();
	const { t } = useI18n();

	let downloadingIds = $state<Record<string, boolean>>({});
	let confirmedLocalIds = $state<Record<string, true>>({});

	const localPresence = resource(
		() => list.replays.map((replay) => `${replay.id}:${replay.filename}`).join('|'),
		async () => {
			const entries = await Promise.all(
				list.replays.map(
					async (row) =>
						[row.id, await app.database.replays.localExists(row.filename)] as const
				)
			);
			return Object.fromEntries(entries) as Record<string, boolean>;
		}
	);

	const localPresentIds = $derived({
		...(localPresence.current ?? {}),
		...confirmedLocalIds
	});

	const highlightedPlayers = $derived(list.filters.players);

	const columns: ColumnDef<ReplaysExpanded>[] = [
		{ id: 'title', header: t('Title'), width: 'w-3/24', class: 'truncate', accessor: (item) => item.title },
		{ id: 'allies', header: t('Allies'), width: 'w-3/24', class: 'flex gap-2' },
		{ id: 'axis', header: t('Axis'), width: 'w-3/24', class: 'flex gap-2' },
		{
			id: 'duration',
			header: t('Duration'),
			width: 'w-3/24',
			sortable: true,
			onSort: toggleDurationSort,
			headerClass: 'flex items-center select-none'
		},
		{
			id: 'players',
			header: t('Players'),
			width: 'w-2/24',
			class: 'text-center',
			headerClass: 'text-center',
			accessor: (item) => item.players?.length
		},
		{ id: 'map', header: t('Map'), width: 'w-4/24', class: 'flex items-center gap-4' },
		{
			id: 'date',
			header: t('Date'),
			width: 'w-3/24',
			class: 'truncate',
			sortable: true,
			onSort: toggleDateSort,
			headerClass: 'flex items-center select-none'
		},
		{ id: 'actions', header: '', width: 'w-4/24', class: 'justify-end gap-0.5' }
	];

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
			component: ReplayRenameModal,
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
		if (downloadingIds[row.id] || localPresentIds[row.id]) return;
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
			app.toast.success(t('Replay published to Member replays.'));
		} catch (error) {
			app.toast.error(
				t('Failed to publish replay: {message}', {
					message: error instanceof Error ? error.message : String(error)
				})
			);
		}
	}
</script>

{#snippet header_duration()}
	<span class="flex w-full items-center">
		{t('Duration')}
		{#if list.filters.sort.duration === 'durationInSeconds'}
			<SortAscendingIcon class="ml-auto inline-block" weight="duotone" size="18" />
		{:else if list.filters.sort.duration === '-durationInSeconds'}
			<SortDescendingIcon class="ml-auto inline-block" weight="duotone" size="18" />
		{:else}
			<SortableIcon class="ml-auto inline-block" weight="duotone" />
		{/if}
	</span>
{/snippet}
{#snippet header_date()}
	<span class="flex w-full items-center">
		{t('Date')}
		{#if list.filters.sort.gameDate === 'gameDate'}
			<SortAscendingIcon class="ml-auto inline-block" weight="duotone" size="18" />
		{:else if list.filters.sort.gameDate === '-gameDate'}
			<SortDescendingIcon class="ml-auto inline-block" weight="duotone" size="18" />
		{:else}
			<SortableIcon class="ml-auto inline-block" weight="duotone" />
		{/if}
	</span>
{/snippet}
{#snippet cell_allies({ row }: { row: ReplaysExpanded })}
	<Match.Players team="allies" {highlightedPlayers} />
{/snippet}
{#snippet cell_axis({ row }: { row: ReplaysExpanded })}
	<Match.Players team="axis" {highlightedPlayers} />
{/snippet}
{#snippet cell_duration({ row }: { row: ReplaysExpanded })}
	<Match.Duration />
{/snippet}
{#snippet cell_map({ row }: { row: ReplaysExpanded })}
	<Match.MapImage small flush />
	<Match.MapName />
{/snippet}
{#snippet cell_date({ row }: { row: ReplaysExpanded })}
	<Match.Date />
{/snippet}
{#snippet cell_actions({ row }: { row: ReplaysExpanded })}
	{@const isDownloading = !!downloadingIds[row.id]}
	{@const isLocal = !!localPresentIds[row.id]}
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class={cn(
			interactive,
			'text-secondary-500 hover:text-secondary-200',
			isLocal && 'pointer-events-none cursor-not-allowed opacity-50'
		)}
		loading={isDownloading}
		disabled={isDownloading || isLocal}
		aria-label={isLocal ? t('Replay available locally') : t('Download replay')}
		{@attach tooltip(isLocal ? t('Available in playback folder') : t('Download to playback folder'))}
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
			'text-secondary-500 hover:text-secondary-200',
			row.visibility === 'member' && 'pointer-events-none cursor-not-allowed opacity-50'
		)}
		disabled={row.visibility === 'member'}
		aria-label={row.visibility === 'member' ? t('Published') : t('Publish to Member replays')}
		{@attach tooltip(row.visibility === 'member' ? t('Already published') : t('Publish to Member replays'))}
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
		class={cn(interactive, 'text-secondary-500 hover:text-secondary-200')}
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
		class={cn(interactive, 'text-secondary-500 hover:text-destructive')}
		aria-label={t('Delete replay')}
		{@attach tooltip(t('Delete'))}
		onclick={() => openDelete(row)}
	>
		<TrashIcon size={16} />
	</Button>
{/snippet}
{#snippet replayRowWrapper({ row, children }: { row: ReplaysExpanded; children: Snippet })}
	<Match.Root match={row}>
		{@render children()}
	</Match.Root>
{/snippet}
{#snippet tableFooter()}
	{#if list.replays.length > 0 || !list.isLoading}
		<div {@attach viewport} class="text-secondary-400 text-sm">
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
{/snippet}

<DataTable
	data={list.replays}
	{columns}
	rowKey={(item) => item.id}
	rowHref={(item) => `/replays/${item.id}`}
	rowClass={() => 'text-secondary-300'}
	rowWrapper={replayRowWrapper}
	loading={list.isLoading && list.replays.length === 0}
	skeletonRows={10}
	empty=""
	headers={{ duration: header_duration, date: header_date }}
	cells={{
		allies: cell_allies,
		axis: cell_axis,
		duration: cell_duration,
		map: cell_map,
		date: cell_date,
		actions: cell_actions
	}}
>
	{@render tableFooter()}
</DataTable>
