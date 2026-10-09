import type { MyTournamentMatch } from '@company-of-heroes/api';
import { api, unwrapApi } from '$core/api';
import type { Match } from '$core/game/lobby';
import { toast } from '$lib/components/ui/toasts';
import { t } from '$lib/i18n';

export type ArmedGame = {
	tournamentId: string;
	matchId: string;
	opponentAlias: string;
	opponentSteamId: string;
	expiresAt: number;
};

/**
 * "Start tournament game" on the dashboard: arms the match on the server, then the next 1v1
 * lobby with that opponent is claimed as the tournament game (`claimFor`, before the lobby is
 * published live) so it is hidden from public lists and its Relic result counts.
 */
class TournamentGames {
	/** Waiting for the lobby with the opponent. */
	armed = $state<ArmedGame | null>(null);
	/** The match whose game was claimed this session (until the next dashboard refresh). */
	playingMatchId = $state<string | null>(null);
	busy = $state(false);

	async arm(item: MyTournamentMatch): Promise<void> {
		if (this.busy) {
			return;
		}

		this.busy = true;
		try {
			const armed = await unwrapApi(api.tournaments.arm(item.tournament.id, item.match.id));
			this.armed = {
				tournamentId: item.tournament.id,
				matchId: item.match.id,
				opponentAlias: item.opponent?.alias ?? '',
				opponentSteamId: armed.opponentSteamId,
				expiresAt: Date.parse(armed.expiresAt)
			};
			toast.success(
				t('Ready! Start the lobby with {name} in the game; it counts as your tournament game.', {
					name: this.armed.opponentAlias || t('your opponent')
				})
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? t(error.message) : t('Could not start the tournament game.')
			);
		} finally {
			this.busy = false;
		}
	}

	disarm() {
		this.armed = null;
	}

	/**
	 * For a lobby that just started: the claim to finish before it is published live, or null
	 * when it is not the armed tournament game (not a 1v1 with the opponent, or expired).
	 */
	claimFor(match: Match): Promise<boolean> | null {
		const armed = this.armed;
		if (!armed || match.isReplay || match.players.length !== 2 || !(match.sessionId > 0)) {
			return null;
		}

		if (armed.expiresAt < Date.now()) {
			this.armed = null;
			return null;
		}

		const steamIds = match.players
			.map((player) => player.steamId)
			.filter((steamId): steamId is string => !!steamId);
		if (!steamIds.includes(armed.opponentSteamId)) {
			return null;
		}

		return unwrapApi(
			api.tournaments.claim(armed.tournamentId, armed.matchId, match.sessionId, steamIds)
		)
			.then(() => {
				this.armed = null;
				this.playingMatchId = armed.matchId;
				toast.success(
					t(
						'Tournament game started. It counts automatically and stays hidden until the tournament ends.'
					)
				);
				return true;
			})
			.catch((error: unknown) => {
				toast.error(
					error instanceof Error
						? t(error.message)
						: t('Could not link the lobby to the tournament game.')
				);
				return false;
			});
	}
}

export const tournamentGames = new TournamentGames();
