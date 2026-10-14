import type { CompareAccount } from '@company-of-heroes/api/compare';

export type CompareSide = 'me' | 'them' | null;

/** Which side holds the better value; `null` when they are equal or one side has none. */
export function betterSide(
	mine: number | null,
	theirs: number | null,
	higherWins = true
): CompareSide {
	if (mine == null || theirs == null || mine === theirs) {
		return null;
	}

	return mine > theirs === higherWins ? 'me' : 'them';
}

/** Win share (0–1), or `null` without games. */
export function winShare(record: { wins: number; losses: number } | undefined): number | null {
	if (!record) {
		return null;
	}

	const games = record.wins + record.losses;
	return games > 0 ? record.wins / games : null;
}

export function accountName(account: CompareAccount | undefined, steamId: string): string {
	return account?.name ?? steamId;
}

/** Shared column layout of the mirrored rows: me | label | them. */
export const mirroredRow =
	'grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-3 px-4';
