<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { ColumnDef, DataTableProps } from './table.types';

	type Props = DataTableProps<T>;

	let {
		data,
		columns,
		rowKey,
		rowHref,
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
		tableLayout = 'fixed'
	}: Props = $props();

	function getCellSnippet(column: ColumnDef<T>): Snippet<[{ row: T }]> | undefined {
		return column.cell ?? cells[column.id];
	}

	function getHeaderSnippet(column: ColumnDef<T>): Snippet | string {
		if (headers[column.id]) {
			return headers[column.id]!;
		}
		return column.header;
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

	function handleRowClick(event: MouseEvent, href: string | undefined) {
		if (!href) return;
		const target = event.target as HTMLElement;
		if (target.closest('a, button')) return;
		navigate(href);
	}

	function handleRowKeydown(event: KeyboardEvent, href: string | undefined) {
		if (!href) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		navigate(href);
	}
</script>

{#snippet rowCells(row: T)}
	{#each columns as column (column.id)}
		{@const cellSnippet = getCellSnippet(column)}
		{@const cellHref = column.href?.(row)}
		<td class={cn('px-4', column.cellClass?.(row))}>
			{#if cellSnippet}
				{#if cellHref}
					<a href={cellHref} class={cn('hover:text-primary flex min-w-0 items-center gap-4 transition-colors', column.class)}>
						{@render cellSnippet({ row })}
					</a>
				{:else}
					<div class={cn('flex min-w-0 items-center', column.class)}>
						{@render cellSnippet({ row })}
					</div>
				{/if}
			{:else if cellHref}
				<a href={cellHref} class={cn('hover:text-primary flex min-w-0 items-center transition-colors', column.class)}>
					{getCellContent(row, column) ?? ''}
				</a>
			{:else}
				<div class={cn('flex min-w-0 items-center', column.class)}>
					{getCellContent(row, column) ?? ''}
				</div>
			{/if}
		</td>
	{/each}
{/snippet}

{#snippet skeletonRow()}
	<tr class={cn('h-11 odd:bg-secondary-600/5', bodyRowClass)}>
		{#each columns as column (column.id)}
			<td class={cn('px-4', column.hideSkeleton && 'p-0')}>
				{#if column.hideSkeleton}
					<!-- spacer -->
				{:else}
					<Skeleton class="h-4 w-full" />
				{/if}
			</td>
		{/each}
	</tr>
{/snippet}

{#snippet dataRow(row: T)}
	{@const href = rowHref?.(row)}
	<tr
		class={cn(
			'h-11 odd:bg-secondary-600/5',
			bodyRowClass,
			href && 'hover:text-primary cursor-pointer transition-colors',
			rowClass?.(row)
		)}
		tabindex={href ? 0 : undefined}
		role={href ? 'link' : undefined}
		onclick={(event) => handleRowClick(event, href)}
		onkeydown={(event) => handleRowKeydown(event, href)}
	>
		{@render rowCells(row)}
	</tr>
{/snippet}

<div class={cn('border-secondary-800 overflow-clip rounded-lg border', className)}>
	<table class={cn('w-full', tableLayout === 'auto' ? 'table-auto' : 'table-fixed')}>
		<colgroup>
			{#each columns as column (column.id)}
				<col class={column.width} />
			{/each}
		</colgroup>
		{#if showHeader}
			<thead class={headerClass}>
				<tr class={cn('bg-secondary-950/90 text-secondary-300 text-left font-semibold', headerRowClass)}>
					{#each columns as column (column.id)}
						{@const header = getHeaderSnippet(column)}
						<th class={cn('px-4 py-3', column.headerCellClass)} onclick={column.onSort}>
							<div class={cn('min-w-0', column.headerClass, column.sortable && 'cursor-pointer select-none')}>
								{#if typeof header === 'string'}
									{header}
								{:else}
									{@render header()}
								{/if}
							</div>
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
					<td colspan={columns.length} class="text-secondary-400 px-4 py-3 text-sm">
						{empty}
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
					<td colspan={columns.length} class="border-secondary-800 border-t px-4 py-2">
						{@render children()}
					</td>
				</tr>
			</tfoot>
		{/if}
	</table>
</div>
