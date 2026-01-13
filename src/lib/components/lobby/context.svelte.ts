import type { Lobby } from '$core/app/context';
import { Context } from 'runed';

const context = new Context<() => Lobby>('<lobby />');
export const createLobby = (lobby: () => Lobby) => context.set(lobby);
export const useLobby = () => context.get()();
