import CompareAccounts from './compare-accounts.svelte';
import CompareFactions from './compare-factions.svelte';
import CompareHeadToHead from './compare-head-to-head.svelte';
import CompareHeader from './compare-header.svelte';
import CompareMaps from './compare-maps.svelte';
import CompareRoot from './compare-root.svelte';
import CompareSkeleton from './compare-skeleton.svelte';
import CompareTable from './compare-table.svelte';

export {
	CompareAccounts as Accounts,
	CompareFactions as Factions,
	CompareHeadToHead as HeadToHead,
	CompareHeader as Header,
	CompareMaps as Maps,
	CompareRoot as Root,
	CompareSkeleton as Skeleton,
	CompareTable as Table
};
export { combineCompare, selectionFromParam, selectionParam } from './combine';
export { createCompare, useCompare, type CompareContext } from './context';
export type { CompareBestElo, CompareBestRank, CompareView } from './types';
export type {
	CompareAccount,
	CompareAccountData,
	CompareData
} from '@company-of-heroes/api/compare';
