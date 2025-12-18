import type { LobbiesResponse } from '$core/pocketbase/types';
import type { LobbyPlayer, Match } from '@fknoobs/app';
import { Context } from 'runed';

const context = new Context<LobbiesResponse<LobbyPlayer[], Match | null>>('<match />');
export const createMatch = (match: LobbiesResponse<LobbyPlayer[], Match | null>) =>
	context.set(match);
export const useMatch = () => context.get();
