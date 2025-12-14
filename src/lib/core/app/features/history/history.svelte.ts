import { app } from '$core/app';
import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import type { Lobby } from '$core/company-of-heroes';
import { relic } from '$lib/relic';

export class History extends Feature {
	name = 'History';

	needsResults: number[] = [];

	trackResultsInterval: ReturnType<typeof setInterval> | null = null;

	enable() {
		app.game.on('LOBBY:GAMEOVER', (lobby) => this.saveLobbyResult(lobby));

		if (this.trackResultsInterval) {
			clearInterval(this.trackResultsInterval);
		}

		this.trackResultsInterval = setInterval(() => this.trackResults(), 5000);
	}

	saveLobbyResult(lobby: Lobby) {
		if (false === app.isReady) {
			// return;
		}

		if (!lobby) {
			return;
		}

		app.pocketbase
			.collection('lobbies')
			.getFirstListItem(`sessionId="${lobby.sessionId}"`)
			.then()
			.catch(() => {
				app.pocketbase.collection('lobbies').create({
					sessionId: lobby.sessionId,
					isRanked: lobby.isRanked,
					title: lobby.type,
					map: lobby.map,
					submittedBy: app.game.steamId,
					players: lobby.players.map((player) => player.steamId)
				});

				this.needsResults.push(lobby.sessionId!);
			});
	}

	trackResults() {
		if (app.game.profile?.relic.profile_id && this.needsResults.length > 0) {
			relic.getRecentMatchHistoryForProfile(app.game.profile?.relic.profile_id).then((history) => {
				const completedMatches = history.filter((match) => this.needsResults.includes(match.id));
				completedMatches.forEach(async (match) => {
					try {
						const lobby = await app.pocketbase
							.collection('lobbies')
							.getFirstListItem(`sessionId="${match.id}"`);

						if (lobby) {
							await app.pocketbase.collection('lobbies').update(lobby.id, {
								submittedBy: lobby.submittedBy,
								result: match
							});
						}
					} catch (error) {
						console.error('Error updating lobby result for match id:', match.id, error);
					}
					this.needsResults = this.needsResults.filter((id) => id !== match.id);
				});
			});
		}
	}

	defaultSettings(): { enabled: boolean } {
		return {
			enabled: true
		};
	}
}

export const history = new History();
