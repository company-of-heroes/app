import type { Lobby } from '$core/company-of-heroes';
import { Context } from 'runed';
import Root from './lobby.svelte';
import LobbyMap from './lobby-map.svelte';

const context = new Context<Lobby>('<lobby />');
export const createLobby = (lobby: Lobby) => context.set(lobby);
export const useLobby = () => context.get();

export { Root, LobbyMap as Map };
