import { Context } from 'runed';
import type { CompareView } from './types';

/** Read through getters, so children follow the Root's props (toggling an account keeps the same Root). */
export type CompareContext = {
	/** The selected accounts already combined into one "me". */
	readonly compare: CompareView;
	/** Steam ids of the user's accounts that count as "me". */
	readonly selected: string[];
	/** Receives the full next selection. */
	onSelect(steamIds: string[]): void;
};

const context = new Context<CompareContext>('<compare />');
export const createCompare = (value: CompareContext) => context.set(value);
export const useCompare = () => context.get();
