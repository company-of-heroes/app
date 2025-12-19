import type { MatchExpanded } from '$core/app/database/lobbies';
import type { LobbiesResponse } from '$core/pocketbase/types';
import { Context } from 'runed';

const context = new Context<MatchExpanded>('<match />');
export const createMatch = (match: MatchExpanded) => context.set(match);
export const useMatch = () => context.get();
