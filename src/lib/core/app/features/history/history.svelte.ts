import type { Lobby } from '$core/company-of-heroes';
import type { TransformedMatch } from '@fknoobs/app';
import { app } from '$core/app';
import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import { relic } from '$lib/relic';
import { dirname, join } from '@tauri-apps/api/path';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseReplay } from '@fknoobs/replay-parser';
import { t } from 'try';
import { doesMatchGameDate } from '$lib/utils';

export class History extends Feature {
	name = 'History';

	trackResultsInterval: ReturnType<typeof setInterval> | null = null;

	enable() {
		app.game.on('LOBBY:GAMEOVER', (lobby) => this.saveLobbyResult(lobby));

		if (this.trackResultsInterval) {
			clearInterval(this.trackResultsInterval);
		}

		this.trackResultsInterval = setInterval(() => this.getMatchHistory(), 5000);
	}

	async saveLobbyResult(lobby: Lobby) {
		if (!lobby.sessionId) {
			return;
		}

		app.database.lobbies.exists(lobby.sessionId).then(async (exists) => {
			if (exists) {
				return;
			}

			let { file, replay } = await this.getLastMatchReplay();
			let replayFile: File | undefined = undefined;

			if (lobby.startedAt && doesMatchGameDate(lobby.startedAt, replay.gameDate)) {
				replayFile = file;
			}

			app.database.lobbies.create({
				isRanked: lobby.isRanked,
				title: lobby.type,
				map: lobby.map || 'Unknown',
				sessionId: lobby.sessionId!,
				needsResult: true,
				players: lobby.players,
				replay: replayFile
			});
		});
	}

	async getMatchHistory() {
		if (!app.game.profile?.relic.profile_id) {
			return;
		}

		const lobbiesNeedingResults = await app.database.lobbies.getPaginated(1, 100, {
			filter: 'needsResult=true'
		});

		if (lobbiesNeedingResults.items.length === 0) {
			return;
		}

		const matches = await relic.getRecentMatchHistoryForProfile(app.game.profile.relic.profile_id);

		for (const lobby of lobbiesNeedingResults.items) {
			const match = matches.find((m) => m.id === lobby.sessionId);

			if (match) {
				app.database.lobbies.exists(lobby.sessionId).then((exists) => {
					if (!exists) {
						return;
					}

					app.database.lobbies.update(lobby.id, {
						needsResult: false,
						result: match
					});
				});
			}
		}
	}

	async getLastMatchReplay() {
		const path = await join(
			await dirname(app.settings.companyOfHeroesConfigPath),
			'playback',
			'temp.rec'
		);
		const fileData = await readFile(path);
		const replay = parseReplay(new Uint8Array(fileData));

		return {
			file: new File([fileData], 'replay.rec'),
			replay
		};
	}

	defaultSettings(): { enabled: boolean } {
		return {
			enabled: true
		};
	}
}

export const history = new History();
