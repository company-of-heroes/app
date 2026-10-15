import { Context } from 'runed';
import type { GuideView } from './types';

/** The guides page's data, read through a getter so children follow its updates. */
export type GuideContext = {
	readonly view: GuideView;
};

const context = new Context<GuideContext>('<guide />');
export const createGuide = (value: GuideContext) => context.set(value);
export const useGuide = () => context.get();
