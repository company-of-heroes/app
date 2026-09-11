<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { tableHeadText, tableSortHeader } from '$lib/components/ui/variants';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon';
	import ArrowsDownUpIcon from 'phosphor-svelte/lib/ArrowsDownUpIcon';
	import type { ColumnDef, DataTableProps } from './table.types';
	import { useI18n } from '$lib/i18n';

	type Props = DataTableProps<T>;

	let {
		data,
		columns,
		rowKey,
		rowHref,
		onRowClick,
		isRowExpanded,
		rowClass,
		loading = false,
		skeletonRows = 5,
		empty = 'No results.',
		showHeader = true,
		class: className,
		headerClass,
		headerRowClass,
		bodyRowClass,
		children,
		rowWrapper,
		cells = {},
		headers = {},
		skeletons = {},
		skeletonClasses = {},
		tableLayout = 'fixed',
		density = 'default',
		striped = false
	}: Props = $props();
	const { t } = useI18n();

	const isCompact = $derived(density === 'compact');
	const cellPad = $derived(isCompact ? 'px-4 py-1.5' : 'px-4');
	const headerPad = $derived(isCompact ? 'px-4 py-2' : 'px-4 py-3');
	const rowHeight = $derived(isCompact ? 'h-9' : 'h-11');
	const stripeClass = $derived(striped ? 'odd:bg-secondary-600/5' : undefined);

	function getCellSnippet(column: ColumnDef<T>): Snippet<[{ row: T }]> | undefined {
		return column.cell ?? cells[column.id];
	}

	function getHeaderSnippet(column: ColumnDef<T>): Snippet | string {
		if (headers[column.id]) {
			return headers[column.id]!;
		}
		return column.header;
	}

	function getSkeletonSnippet(column: ColumnDef<T>): Snippet | undefined {
		return column.skeleton ?? skeletons[column.id];
	}

	function getSkeletonClass(column: ColumnDef<T>): string | undefined {
		return column.skeletonClass ?? skeletonClasses[column.id];
	}

	function getCellContent(row: T, column: ColumnDef<T>): unknown {
		if (column.accessor) {
			return column.accessor(row);
		}
		return undefined;
	}

	function navigate(href: string) {
		void goto(href);
	}

	function activateRow(row: T, href: string | undefined) {
		if (onRowClick) {
			onRowClick(row);
			return;
		}
		if (href) navigate(href);
	}

	const overlayContent =
		'relative z-10 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto';
</script>

{#snippet rowCells(row: T)}
	{@const href = rowHref?.(row)}
	{@const clickable = Boolean(href || onRowClick)}
	{#each columns as column (column.id)}
		{@const cellSnippet = getCellSnippet(column)}
		{@const cellHref = column.href?.(row)}
		{@const usePad = column.pad !== false}
		<td
			class={cn(
				usePad && cellPad,
				'relative h-full',
				column.cellClass?.(row),
				clickable && 'p-0!'
			)}
		>
			{#if clickable}
				<button
					type="button"
					class="absolute inset-0 z-0 cursor-pointer"
					tabindex="-1"
					aria-hidden="true"
					onclick={() => activateRow(row, href)}
				></button>
			{/if}
			{#if cellSnippet}
				{#if cellHref}
					<a
						href={cellHref}
						class={cn(
							'hover:text-primary relative z-10 flex h-full min-w-0 items-center gap-4 transition-colors',
							clickable && usePad && cellPad,
							column.class
						)}
					>
						{@render cellSnippet({ row })}
					</a>
				{:else}
					<div
						class={cn(
							overlayContent,
							'flex h-full w-full min-w-0 items-center',
							clickable && usePad && cellPad,
							column.class
						)}
					>
						{@render cellSnippet({ row })}
					</div>
				{/if}
			{:else if cellHref}
				<a
					href={cellHref}
					class={cn(
						'hover:text-primary relative z-10 flex min-w-0 items-center transition-colors',
						clickable && cellPad,
						column.class
					)}
				>
					{getCellContent(row, column) ?? ''}
				</a>
			{:else}
				<div
					class={cn(
						overlayContent,
						'flex min-w-0 items-center',
						clickable && cellPad,
						column.class
					)}
				>
					{getCellContent(row, column) ?? ''}
				</div>
			{/if}
		</td>
	{/each}
{/snippet}

{#snippet skeletonRow()}
	<tr class={cn(rowHeight, 'border-secondary-800 border-b', stripeClass, bodyRowClass)}>
		{#each columns as column (column.id)}
			{@const skeletonSnippet = getSkeletonSnippet(column)}
			{@const skeletonClass = getSkeletonClass(column)}
			<td class={cn(skeletonClass ?? (column.hideSkeleton ? 'p-0' : cellPad))}>
				{#if column.hideSkeleton}
					<!-- spacer -->
				{:else if skeletonSnippet}
					{@render skeletonSnippet()}
				{:else}
					<Skeleton class="h-4 w-20 shrink-0" />
				{/if}
			</td>
		{/each}
	</tr>
{/snippet}

{#snippet dataRow(row: T)}
	{@const href = rowHref?.(row)}
	{@const clickable = href || onRowClick}
	{@const expanded = isRowExpanded?.(row) ?? false}
	<tr
		class={cn(
			rowHeight,
			'border-secondary-800',
			!expanded && 'border-b',
			stripeClass,
			bodyRowClass,
			clickable && 'hover:text-primary cursor-pointer outline-none transition-colors',
			clickable && 'hover:bg-secondary-950/60',
			expanded && 'bg-secondary-950/60 text-primary',
			rowClass?.(row)
		)}
		tabindex={clickable && !onRowClick ? 0 : undefined}
		role={href ? 'link' : undefined}
		aria-expanded={onRowClick ? expanded : undefined}
		onkeydown={(event) => {
			if (!clickable) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			activateRow(row, href);
		}}
	>
		{@render rowCells(row)}
	</tr>
{/snippet}

<div class={cn(className)}>
	<table
		class={cn(
			'w-full border-collapse',
			tableLayout === 'auto' ? 'table-auto' : 'table-fixed'
		)}
	>
		<colgroup>
			{#each columns as column (column.id)}
				<col class={column.width} />
			{/each}
		</colgroup>
		{#if showHeader}
			<thead class={headerClass}>
				<tr
					class={cn(
						'bg-secondary-950/90 border-secondary-800 border-b text-left',
						tableHeadText,
						headerRowClass
					)}
				>
					{#each columns as column (column.id)}
						{@const header = getHeaderSnippet(column)}
						<th
							class={cn(headerPad, column.headerCellClass)}
							aria-sort={column.sortDirection === 'asc'
								? 'ascending'
								: column.sortDirection === 'desc'
									? 'descending'
									: column.sortable
										? 'none'
										: undefined}
						>
							{#if column.sortable}
								<button
									type="button"
									class={cn(
										tableSortHeader,
										typeof header === 'string' && 'gap-1',
										column.headerClass
									)}
									aria-label={typeof header === 'string' ? t('Sort by {header}', { header }) : undefined}
									onclick={column.onSort}
								>
									{#if typeof header === 'string'}
										{t(header)}
										{#if column.sortDirection === 'desc'}
											<ArrowDownIcon size={14} class="shrink-0" weight="duotone" />
										{:else if column.sortDirection === 'asc'}
											<ArrowUpIcon size={14} class="shrink-0" weight="duotone" />
										{:else}
											<ArrowsDownUpIcon size={14} class="shrink-0" weight="duotone" />
										{/if}
									{:else}
										{@render header()}
									{/if}
								</button>
							{:else}
								<div class={cn('min-w-0', column.headerClass)}>
									{#if typeof header === 'string'}
										{t(header)}
									{:else}
										{@render header()}
									{/if}
								</div>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
		{/if}
		<tbody>
			{#if loading}
				{#each Array(skeletonRows) as _, index (index)}
					{@render skeletonRow()}
				{/each}
			{:else if data.length === 0}
				<tr>
					<td colspan={columns.length} class={cn('text-secondary-400 text-sm', cellPad, isCompact ? '' : 'py-3')}>
						{t(empty)}
					</td>
				</tr>
			{:else}
				{#each data as row (rowKey(row))}
					{#if rowWrapper}
						{#snippet rowContent()}
							{@render dataRow(row)}
						{/snippet}
						{@render rowWrapper({ row, children: rowContent })}
					{:else}
						{@render dataRow(row)}
					{/if}
				{/each}
			{/if}
		</tbody>
		{#if children}
			<tfoot>
				<tr>
					<td colspan={columns.length} class={cn('border-secondary-800 border-t', cellPad, isCompact ? 'py-2' : 'py-3')}>
						{@render children()}
					</td>
				</tr>
			</tfoot>
		{/if}
	</table>
</div>
