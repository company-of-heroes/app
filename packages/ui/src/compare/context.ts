import type { Compare } from '@company-of-heroes/api/compare';
import { Context } from 'runed';

/** Read through getters, so children follow the Root's props (toggling an account keeps the same Root). */
export type CompareContext = {
	readonly compare: Compare;
	/** Steam ids of the user's accounts that count as "me". */
	readonly selected: string[];
	/** Receives the full next selection. */
	onSelect(steamIds: string[]): void;
};

const context = new Context<CompareContext>('<compare />');
export const createCompare = (value: CompareContext) => context.set(value);
export const useCompare = () => context.get();
