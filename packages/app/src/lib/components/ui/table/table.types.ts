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
};

export type DataTableProps<T> = {
	data: T[];
	columns: ColumnDef<T>[];
	rowKey: (row: T) => string | number;
	rowHref?: (row: T) => string | undefined;
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
	tableLayout?: 'fixed' | 'auto';
};
