import type { Snippet } from 'svelte';

export type SortDirection = 'asc' | 'desc' | null;

export type ColumnDef<T> = {
	id: string;
	header: string | Snippet;
	width?: string;
	class?: string;
	cellClass?: (row: T) => string;
	headerClass?: string;
	accessor?: (row: T) => unknown;
	cell?: Snippet<[{ row: T }]>;
	href?: (row: T) => string | undefined;
	sortable?: boolean;
	onSort?: () => void;
	sortDirection?: SortDirection;
	headerCellClass?: string;
	hideSkeleton?: boolean;
	/** When false, skip the default cell padding (`px-4`). Default true. */
	pad?: boolean;
	/** Custom loading placeholder for this column (preferred over the default bar). */
	skeleton?: Snippet;
	/** Classes for the skeleton `<td>` (padding / width); defaults to cell padding. */
	skeletonClass?: string;
};

export type DataTableDensity = 'default' | 'compact';

export type DataTableProps<T> = {
	data: T[];
	columns: ColumnDef<T>[];
	rowKey: (row: T) => string | number;
	rowHref?: (row: T) => string | undefined;
	onRowClick?: (row: T) => void;
	isRowExpanded?: (row: T) => boolean;
	rowClass?: (row: T) => string;
	loading?: boolean;
	skeletonRows?: number;
	empty?: string;
	showHeader?: boolean;
	class?: string;
	headerClass?: string;
	headerRowClass?: string;
	bodyRowClass?: string;
	children?: Snippet;
	rowWrapper?: Snippet<[{ row: T; children: Snippet }]>;
	cells?: Partial<Record<string, Snippet<[{ row: T }]>>>;
	headers?: Partial<Record<string, Snippet>>;
	/** Per-column loading placeholders (merged after `column.skeleton`). */
	skeletons?: Partial<Record<string, Snippet>>;
	/** Per-column skeleton `<td>` classes (merged after `column.skeletonClass`). */
	skeletonClasses?: Partial<Record<string, string>>;
	tableLayout?: 'fixed' | 'auto';
	density?: DataTableDensity;
	striped?: boolean;
};
