import type { Match } from '$core/app/context';
import { Context } from 'runed';

const context = new Context<() => Match>('<lobby />');
export const createLobby = (lobby: () => Match) => context.set(lobby);
export const useLobby = () => context.get()();
