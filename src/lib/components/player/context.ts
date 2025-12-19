import type { LeaderboardStat, LobbyPlayer, MatchHistoryPlayer } from '@fknoobs/app';
import { Context } from 'runed';

const context = new Context<{
	player: LobbyPlayer;
	playerResult?: MatchHistoryPlayer;
	stats?: LeaderboardStat;
}>('<player />');

export const createPlayer = (
	player: LobbyPlayer,
	playerResult?: MatchHistoryPlayer,
	stats?: LeaderboardStat
) => context.set({ player, playerResult, stats });
export const usePlayer = () => context.get();
