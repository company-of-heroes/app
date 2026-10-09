import { Context } from 'runed';
import type { ReplayData } from './types';

/** Read through a getter, so children follow the Root's `replay` prop. */
export type ReplayDataContext = {
	readonly replay: ReplayData;
};

const context = new Context<ReplayDataContext>('<replay-data />');
export const createReplayData = (value: ReplayDataContext) => context.set(value);
export const useReplayData = () => context.get();
/** For pieces that also render without a replay (the overview of a match that has none). */
export const useOptionalReplayData = () => context.getOr(null);
