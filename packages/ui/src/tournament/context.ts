import { Context } from 'runed';
import type {
	Tournament,
	TournamentMatch,
	TournamentParticipant,
	TournamentPost,
	TournamentReplay,
	TournamentStanding
} from './types';

/** The tournament page's data, read through getters so children follow its updates. */
export type TournamentContext = {
	readonly tournament: Tournament;
	readonly matches: TournamentMatch[];
	readonly participants: TournamentParticipant[];
	readonly participantsById: Map<string, TournamentParticipant>;
	readonly standings: TournamentStanding[];
	readonly posts: TournamentPost[];
	readonly replays: TournamentReplay[];
	/** Links to the games; off while they are hidden (the tournament is still running). */
	readonly revealGames: boolean;
	/** The viewer runs this tournament: staff, or the host who created it. */
	readonly canManage: boolean;
};

const context = new Context<TournamentContext>('<tournament />');
export const createTournament = (value: TournamentContext) => context.set(value);
export const useTournament = () => context.get();
