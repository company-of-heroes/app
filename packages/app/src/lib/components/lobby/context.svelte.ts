import type { Match } from '$core/app/context';
import { Context } from 'runed';

const context = new Context<Match>('<lobby />');
export const createLobby = (match: () => Match) => context.set(match());
export const useLobby = () => context.get();
