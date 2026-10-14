import type { CompareAccount } from '@company-of-heroes/api/compare';

export function accountName(account: CompareAccount | undefined, steamId: string): string {
	return account?.name ?? steamId;
}

/** Shared column layout of the mirrored rows: me | label | them. */
export const mirroredRow =
	'grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-3 px-4';
