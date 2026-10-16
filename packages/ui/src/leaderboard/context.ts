import { Context } from 'runed';
import type { LeaderboardState } from './leaderboard-state.svelte';

/** The state object reads its inputs through getters, so children follow the Root's props. */
const context = new Context<LeaderboardState>('<leaderboard />');
export const createLeaderboard = (state: LeaderboardState) => context.set(state);
export const useLeaderboard = () => context.get();
