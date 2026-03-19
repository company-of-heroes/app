import type { MatchExpanded } from '$core/app/database/matches';
import { app, type Match } from '$core/app/context';
import { Feature } from '../feature.svelte';
import { relic } from '$lib/relic';
import { join } from '@tauri-apps/api/path';
import { exists, readFile } from '@tauri-apps/plugin-fs';
import { parseReplay } from '@fknoobs/replay-parser';
import { download } from '@tauri-apps/plugin-upload';
import { Matches } from './matches.svelte';

export class History extends Feature {
	name = 'History';

	trackResultsInterval: ReturnType<typeof setInterval> | null = null;

	matches!: Matches;

	enable() {
		app.on('lobby.destroyed', ({ match }) => this.saveLobbyResult(match));

		if (this.trackResultsInterval) {
			clearInterval(this.trackResultsInterval);
		}

		this.trackResultsInterval = setInterval(() => this.getMatchHistory(), 5000);
		this.matches = new Matches();
	}

	async saveLobbyResult(lobby: Match) {
		if (!lobby.sessionId || !app.isReady) {
			return;
		}

		app.database.matches.exists(lobby.sessionId).then(async (exists) => {
			if (exists) {
				return;
			}

			let { file } = await this.getLastMatchReplay();

			app.database.matches.create({
				isRanked: lobby.isRanked,
				title: lobby.type,
				map: lobby.map || 'Unknown',
				sessionId: lobby.sessionId!,
				needsResult: true,
				players: lobby.players,
				replay: file
			});
		});
	}

	async getMatchHistory() {
		if (!app.game.profile?.relic.profile_id) {
			return;
		}

		const matchesNeedingResults = await app.database.matches.getPaginated(1, 100, {
			filter: `needsResult=true && ${app.features.auth.user.steamIds.map((id) => `user.steamIds ~ "${id}"`).join(' || ')}`
		});

		if (matchesNeedingResults.items.length === 0) {
			return;
		}

		const matches = await relic.getRecentMatchHistoryForProfile(app.game.profile.relic.profile_id);

		for (const lobby of matchesNeedingResults.items) {
			const match = matches.find((m) => m.id === lobby.sessionId);

			if (match) {
				app.database.matches.exists(lobby.sessionId).then((exists) => {
					if (!exists) {
						return;
					}

					app.database.matches.update(lobby.id, {
						needsResult: false,
						result: match
					});
				});
			}
		}
	}

	async getLastMatchReplay() {
		const path = await join(await app.paths.cohPlaybackDir(), 'temp.rec');
		const fileData = await readFile(path);
		const replay = parseReplay(new Uint8Array(fileData));

		return {
			file: new File([fileData], 'replay.rec'),
			replay
		};
	}

	async downloadReplay(match: MatchExpanded) {
		try {
			const path = await join(await app.paths.cohPlaybackDir(), match.replay);
			const url = app.pocketbase.files.getURL(match, match.replay);

			await download(url, path);
			app.toast.success('Replay saved to the Company of Heroes playback folder.');
			return true;
		} catch (error) {
			app.toast.error('Failed to download replay: ' + (error as Error).message);
			return false;
		}
	}

	async downloadExists(match: MatchExpanded): Promise<boolean> {
		const path = await join(await app.paths.cohPlaybackDir(), match.replay);

		return await exists(path);
	}

	defaultSettings(): { enabled: boolean } {
		return {
			enabled: true
		};
	}
}

export const history = new History();
