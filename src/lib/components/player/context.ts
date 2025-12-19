import type { MatchHistoryPlayer } from '@fknoobs/app';
import { Context } from 'runed';

const context = new Context<MatchHistoryPlayer>('<player />');

export const createPlayer = (player: MatchHistoryPlayer) => context.set(player);
export const usePlayer = () => context.get();
