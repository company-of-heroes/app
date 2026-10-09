import type { LeaderboardStat, LobbyPlayer, MatchHistoryPlayer } from '@fknoobs/app';
import { Context } from 'runed';

const context = new Context<
	() => {
		player: LobbyPlayer;
		playerResult?: MatchHistoryPlayer;
		stats?: LeaderboardStat;
		race?: number;
	}
>('<player />');

export const createPlayer = (
	player: () => {
		player: LobbyPlayer;
		playerResult?: MatchHistoryPlayer;
		stats?: LeaderboardStat;
		race?: number;
	}
) => context.set(player);
export const usePlayer = () => context.get()();
/** The `Player.Root` player as a getter, or `null` outside a Root. */
export const useOptionalPlayer = () => {
	const player = context.getOr(null);
	return () => player?.() ?? null;
};
