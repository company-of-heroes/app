import { Context } from 'runed';
import type { MatchView } from './match-view';

const context = new Context<() => MatchView>('<match />');
export const createMatch = (match: () => MatchView) => context.set(match);
export const useMatch = () => context.get()();
