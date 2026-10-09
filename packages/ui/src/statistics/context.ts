import { Context } from 'runed';
import type { CommunityStatistics } from './types';

/** Read through getters, so children follow the Root's props (switching mode keeps the same Root). */
export type StatisticsContext = {
	readonly statistics: CommunityStatistics;
	/** The map the page is filtered on, or `null` for every map. */
	readonly selected: string | null;
};

const context = new Context<StatisticsContext>('<statistics />');
export const createStatistics = (value: StatisticsContext) => context.set(value);
export const useStatistics = () => context.get();
