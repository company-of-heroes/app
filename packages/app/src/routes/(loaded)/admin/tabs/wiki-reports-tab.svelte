<script lang="ts">
	import type { Snippet } from 'svelte';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { tabTrigger, type SemanticVariant } from '$lib/components/ui/variants';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import {
		DocsReportsStatusOptions,
		type DocsReportsResponse,
		type UsersResponse
	} from '$core/pocketbase/types';
	import { resource } from 'runed';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';

	const { t } = useI18n();

	type StatusFilter = 'all' | DocsReportsStatusOptions;
	type ReportRow = DocsReportsResponse<{ reporter?: UsersResponse }>;

	const statusFilters: { id: StatusFilter; label: string }[] = [
		{ id: 'all', label: t('All') },
		{ id: DocsReportsStatusOptions.open, label: t('Open') },
		{ id: DocsReportsStatusOptions.resolved, label: t('Resolved') },
		{ id: DocsReportsStatusOptions.dismissed, label: t('Dismissed') }
	];

	let statusFilter = $state<StatusFilter>('open');
	let expandedOverride = $state<string | null | undefined>(undefined);
	let updatingId = $state<string | null>(null);

	const loadReports = async (status: StatusFilter): Promise<ReportRow[]> => {
		try {
			const response = await pocketbase.collection('docs_reports').getList<ReportRow>(1, 50, {
				...(status === 'all' ? {} : { filter: `status = "${status}"` }),
				sort: '-created',
				expand: 'reporter',
				fetch
			});
			return response.items;
		} catch (error) {
			console.error('[ADMIN]: wiki reports load failed:', error);
			app.toast.error(t('Could not load wiki reports.'));
			return [];
		}
	};

	const reports = resource(
		() => (app.account.isStaff ? statusFilter : null),
		async (status) => (status ? loadReports(status) : [])
	);

	const rows = $derived(reports.current ?? []);
	const expandedId = $derived.by(() => {
		if (expandedOverride === undefined) {
			return rows[0]?.id ?? null;
		}

		if (expandedOverride === null || rows.some((report) => report.id === expandedOverride)) {
			return expandedOverride;
		}

		return rows[0]?.id ?? null;
	});

	const columns = $derived.by((): ColumnDef<ReportRow>[] => [
		{ id: 'page', header: t('Page'), width: 'w-8/24', class: 'min-w-0 truncate font-medium' },
		{
			id: 'reporter',
			header: t('Reporter'),
			width: 'w-5/24',
			class: 'text-secondary-400 min-w-0 truncate text-sm'
		},
		{
			id: 'date',
			header: t('Date'),
			width: 'w-5/24',
			class: 'text-secondary-400 truncate text-sm'
		},
		{ id: 'status', header: t('Status'), width: 'w-5/24' },
		{
			id: 'expand',
			header: '',
			width: 'w-1/24',
			headerCellClass: 'p-0',
			cellClass: () => 'p-0',
			class: 'flex w-full justify-center',
			hideSkeleton: true
		}
	]);

	const statusLabel = (status: DocsReportsStatusOptions) => {
		if (status === 'open') {
			return t('Open');
		}

		if (status === 'resolved') {
			return t('Resolved');
		}

		return t('Dismissed');
	};

	const statusVariant = (status: DocsReportsStatusOptions): SemanticVariant => {
		if (status === 'open') {
			return 'warning';
		}

		if (status === 'resolved') {
			return 'success';
		}

		return 'default';
	};

	function formatDate(value: string) {
		if (!value) {
			return '';
		}

		return new Date(value).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function toggleExpanded(id: string) {
		expandedOverride = expandedId === id ? null : id;
	}

	const setStatus = async (report: ReportRow, status: DocsReportsStatusOptions) => {
		updatingId = report.id;
		try {
			await pocketbase.collection('docs_reports').update(report.id, { status }, { fetch });
			reports.mutate(await loadReports(statusFilter));
		} catch (error) {
			console.error('[ADMIN]: wiki report update failed:', error);
			app.toast.error(t('Could not update report.'));
		} finally {
			updatingId = null;
		}
	};
</script>

{#snippet cell_page({ row }: { row: ReportRow })}
	{row.page || row.url}
{/snippet}
{#snippet cell_reporter({ row }: { row: ReportRow })}
	{row.expand?.reporter?.name || row.reporter}
{/snippet}
{#snippet cell_date({ row }: { row: ReportRow })}
	{formatDate(row.created)}
{/snippet}
{#snippet cell_status({ row }: { row: ReportRow })}
	<Badge variant={statusVariant(row.status)} class="px-2 py-0.5">
		{statusLabel(row.status)}
	</Badge>
{/snippet}
{#snippet cell_expand({ row }: { row: ReportRow })}
	<CaretDownIcon
		class={cn(
			'pointer-events-none size-4 transition-transform',
			expandedId === row.id && 'rotate-180'
		)}
	/>
{/snippet}
{#snippet rowWrapper({ row, children }: { row: ReportRow; children: Snippet })}
	{@render children()}
	{#if expandedId === row.id}
		<tr class="border-secondary-800 border-b">
			<td colspan={columns.length} class="p-0">
				<div class="border-secondary-800 divide-secondary-800 divide-y border-t">
					<p class="text-secondary-500 truncate px-4 py-2.5 text-xs">{row.url}</p>
					<p class="text-secondary-200 px-4 py-3 text-sm whitespace-pre-line">
						{row.description}
					</p>
					<div class="flex flex-wrap gap-2 px-4 py-3">
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onclick={() => void openUrl(row.url)}
						>
							<ArrowSquareOutIcon size={16} />
							{t('Open page')}
						</Button>
						{#if row.status === 'open'}
							<Button
								type="button"
								size="sm"
								variant="success"
								loading={updatingId === row.id}
								onclick={() => void setStatus(row, 'resolved')}
							>
								{t('Mark as resolved')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								loading={updatingId === row.id}
								onclick={() => void setStatus(row, 'dismissed')}
							>
								{t('Dismiss')}
							</Button>
						{:else}
							<Button
								type="button"
								size="sm"
								variant="secondary"
								loading={updatingId === row.id}
								onclick={() => void setStatus(row, 'open')}
							>
								{t('Reopen')}
							</Button>
						{/if}
					</div>
				</div>
			</td>
		</tr>
	{/if}
{/snippet}

<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
	{#each statusFilters as filter (filter.id)}
		<button
			type="button"
			class={tabTrigger}
			data-state={statusFilter === filter.id ? 'active' : undefined}
			onclick={() => {
				statusFilter = filter.id;
				expandedOverride = undefined;
			}}
		>
			{filter.label}
		</button>
	{/each}
</div>

{#if !reports.loading && rows.length === 0}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('No wiki reports.')}</p>
{:else}
	<DataTable
		data={rows}
		{columns}
		rowKey={(report) => report.id}
		onRowClick={(report) => toggleExpanded(report.id)}
		isRowExpanded={(report) => expandedId === report.id}
		{rowWrapper}
		loading={reports.loading && rows.length === 0}
		skeletonRows={4}
		striped={false}
		empty={t('No wiki reports.')}
		cells={{
			page: cell_page,
			reporter: cell_reporter,
			date: cell_date,
			status: cell_status,
			expand: cell_expand
		}}
	/>
{/if}
