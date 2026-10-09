import { goto, invalidateAll, replaceState } from '$app/navigation';
import { openUrl } from '@tauri-apps/plugin-opener';
import { page } from '$app/state';
import { confirm } from '@tauri-apps/plugin-dialog';
import { provideHost, type HostContext } from '@company-of-heroes/ui/host';
import { toPlayerPreviewData, type PlayerEloMap } from '@company-of-heroes/ui/player';
import type { CommunityMatchDetail } from '@company-of-heroes/ui/replay';
import { buildProfileLinks, pickOwnedSteamId } from '@company-of-heroes/api';
import { account } from '$core/account';
import { api, unwrapApi } from '$core/api';
import { app } from '$core/app/context';
import { SITE_URL } from '$core/site/urls';
import { findCompanionUserBySteamId, readMetaVersion } from '$core/pocketbase/companion-user';
import { findHiddenMatch, hideMatch, unhideMatch } from '$core/pocketbase/hidden-matches';
import { userAvatarSrc } from '$lib/components/user/user-avatar-src';
import { getI18n, t } from '$lib/i18n';
import { translateText } from '$lib/translate';
import { isMeReplayAlias } from '$lib/utils/player-me';
import { getFactionFlagFromRace, getRankImage, getRankImageByLeaderboardId } from '$lib/utils';
import {
	getDefaultMapImage,
	getFactionFlagFromLeaderboardId,
	getMapImageFromName,
	getString
} from '$lib/utils/game';
import { flagImageUrl } from '$lib/utils/leaderboard-resolvers';
import { getActionIcon } from '$lib/utils/action-icons';
import { getMedals } from '$lib/utils/medals';
import { labelsForSteamId, preloadPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
import { isStreamerLive } from '$core/pocketbase/live-streamers-cache.svelte';

const doctrineBanners = import.meta.glob<string>('$lib/files/ct_branchbanner_*.png', {
	eager: true,
	query: '?url',
	import: 'default'
});

/** Desktop wiring for shared `@company-of-heroes/ui` components. Call once in the loaded layout. */
export function provideAppHost(): HostContext {
	return provideHost({
		locale: () => getI18n().getLocale(),
		openExternal: (url) =>
			void openUrl(url).catch(() => app.toast.error(t('Could not open the link.'))),
		href: (path) => path,
		routes: {
			player: (id) => `/players/${id}`,
			match: (lobbyId) => `/history/${lobbyId}`,
			accountProfile: (steamId) => `/account/profile?steamId=${steamId}`,
			login: () => '/account',
			memberReplays: () => '/history?tab=member',
			memberReplay: (id) => `/replays/${id}`,
			publishReplay: (lobbyId) => `/replays/upload?fromMatch=${lobbyId}`,
			replayList: () => '/history',
			shareReplay: (id) => `${SITE_URL}/replays/${id}`,
			tournaments: () => '/tournaments',
			tournament: (slug) => `/tournaments/${slug}`,
			tournamentNew: () => '/tournaments/new',
			tournamentEdit: (slug) => `/tournaments/${slug}/edit`,
			tournamentHallOfFame: () => '/tournaments/hall-of-fame'
		},
		url: {
			param: (name) => page.url.searchParams.get(name),
			dropParam: (name) => {
				if (!page.url.searchParams.has(name)) {
					return;
				}

				const url = new URL(page.url.href);
				url.searchParams.delete(name);
				replaceState(`${url.pathname}${url.search}${url.hash}`, page.state);
			},
			goto: (path) => goto(path)
		},
		resolve: {
			flagImageUrl,
			avatarUrl: (url) => url,
			mapSrc: getMapImageFromName,
			mapFallbackSrc: getDefaultMapImage,
			factionFlagByRace: getFactionFlagFromRace,
			factionFlagByLeaderboard: getFactionFlagFromLeaderboardId,
			rankImageByRace: getRankImage,
			rankImageByLeaderboard: getRankImageByLeaderboardId,
			gameString: (key) => getString(key) || null,
			doctrineBanner: (file) =>
				Object.entries(doctrineBanners).find(([path]) => path.endsWith(`/${file}`))?.[1] ?? '',
			actionIcon: getActionIcon,
			medals: getMedals,
			userAvatar: (user) => user.avatarUrl || userAvatarSrc({ id: user.id })
		},
		auth: {
			get user() {
				if (!account.isAuthenticated) {
					return null;
				}

				return {
					id: account.userId,
					name: account.user.name || account.email,
					avatarUrl: userAvatarSrc(account.user),
					steamIds: account.user.steamIds,
					isStaff: account.isStaff
				};
			},
			isSelfAlias: isMeReplayAlias,
			isSelf: (steamId, profileId) =>
				account.user.steamIds.includes(steamId) ||
				(profileId !== undefined && app.game.profile?.relic.profile_id === profileId)
		},
		openNotification: (notification) => void app.notifications.open(notification),
		notify: {
			success: (message) => app.toast.success(message),
			error: (message) => app.toast.error(message),
			confirm: (message, labels) =>
				confirm(message, {
					okLabel: labels?.confirm ?? t('OK'),
					cancelLabel: labels?.cancel ?? t('Cancel'),
					kind: 'warning'
				})
		},
		api: {
			players: {
				getPreview: async (id) => {
					const result = await api.players.get(id);
					return result.isOk() ? toPlayerPreviewData(result.value) : null;
				},
				getElo: async (steamId) =>
					((await unwrapApi(api.ratings.getPlayerRating(steamId)))?.elo ?? {}) as PlayerEloMap,
				getStats: async (id) => {
					const result = await api.players.get(id);
					return result.isOk()
						? {
								leaderboardStats: result.value.leaderboardStats,
								elo: result.value.elo as PlayerEloMap
							}
						: null;
				},
				search: async (query) => {
					const result = await api.players.search(query, { requireMatches: true });
					if (result.isErr()) {
						return [];
					}

					return result.value.map((player) => ({
						value: player.steamId,
						label: player.alias || player.steamId,
						avatarUrl: player.avatarUrl || null,
						country: player.country ?? null,
						profileId: player.profileId || null
					}));
				}
			},
			social: {
				getMyVote: ({ kind, id }) => {
					if (kind === 'player') {
						return app.database.playerSocial.getMyVote(id);
					}

					return kind === 'replay'
						? app.database.matchSocial.getMyReplayVote(id)
						: app.database.matchSocial.getMyVote(id);
				},
				setVote: ({ kind, id }, value) => {
					if (kind === 'player') {
						return app.database.playerSocial.setPlayerVote(id, value);
					}

					return kind === 'replay'
						? app.database.matchSocial.setReplayVote(id, value)
						: app.database.matchSocial.setLobbyVote(id, value);
				}
			},
			comments: {
				list: ({ kind, id }) =>
					kind === 'replay'
						? app.database.matchSocial.listReplayComments(id)
						: app.database.matchSocial.listComments(id),
				create: ({ kind, id }, text, parentId) =>
					kind === 'replay'
						? app.database.matchSocial.createReplayComment(id, text, parentId)
						: app.database.matchSocial.createComment(id, text, parentId),
				update: (kind, commentId, text) =>
					kind === 'replay'
						? app.database.matchSocial.updateReplayComment(commentId, text)
						: app.database.matchSocial.updateComment(commentId, text),
				remove: (kind, commentId, note) =>
					kind === 'replay'
						? app.database.matchSocial.deleteReplayComment(commentId, note)
						: app.database.matchSocial.deleteComment(commentId, note),
				vote: (kind, commentId, value) =>
					kind === 'replay'
						? app.database.matchSocial.setReplayCommentVote(commentId, value)
						: app.database.matchSocial.setCommentVote(commentId, value),
				searchMentions: async (query) => {
					const users = await app.database.matchSocial.searchMentionUsers(query);
					return users.map((user) => ({
						id: user.id,
						name: user.name,
						avatarUrl: user.avatarUrl || userAvatarSrc(user),
						steamIds: user.steamIds
					}));
				}
			},
			translate: translateText,
			replays: {
				previewRatings: (input) => unwrapApi(api.replays.previewMemberStats(input)),
				upload: (input) => unwrapApi(api.replays.uploadMember(input)),
				publishFromMatch: (lobbyId, input) => app.database.replays.publishFromMatch(lobbyId, input),
				update: async (id, input) => {
					await unwrapApi(api.replays.updateMember(id, input));
				},
				remove: async (id) => {
					await unwrapApi(api.replays.deleteMember(id));
				},
				getFile: async (match) =>
					match.kind === 'member'
						? app.database.replays.getById(match.id)
						: app.database.replays.getByLobbyId(match.id),
				// The desktop saves straight into the game's playback folder instead of a browser download.
				downloadHref: () => null,
				download: async (match) => {
					if (match.kind === 'member') {
						try {
							await app.database.replays.download(match.id);
							app.toast.success(t('Replay saved to the Company of Heroes playback folder.'));
						} catch (error) {
							app.toast.error(
								t('Failed to download replay: {message}', {
									message: error instanceof Error ? error.message : String(error)
								})
							);
							throw error;
						}

						return;
					}

					const result = await app.features.history.downloadReplay(
						await app.database.matches.getById(match.id)
					);
					if (!result.ok) {
						throw new Error('download failed');
					}

					return { downloadCount: result.downloadCount };
				},
				attach: async (lobbyId, file, durationSeconds) => {
					const result = await app.database.matches.attachReplay(lobbyId, file, {
						durationSeconds
					});
					await invalidateAll();
					return { keptExisting: result.keptExisting };
				},
				loadMatchForPublish: async (lobbyId) => {
					const match = await app.database.matches.getById(lobbyId);
					const ownerId =
						typeof match.user === 'string' ? match.user : String(match.user?.id || '');
					if (!ownerId || ownerId !== app.account.userId) {
						throw new Error(t('You can only publish your own matches.'));
					}

					const linked =
						typeof match.memberReplay === 'string'
							? match.memberReplay
							: String((match.memberReplay as { id?: string } | undefined)?.id || '');
					if (linked) {
						await goto(`/replays/${linked}`);
						return null;
					}

					if (!(match.hasReplay || match.replay)) {
						throw new Error(t('This match has no replay file.'));
					}

					const detail = await app.database.replays.getLobbyDetail(lobbyId);
					return {
						file: new File([detail.bytes], String(match.replay || `${lobbyId}.rec`), {
							type: 'application/octet-stream'
						}),
						title: match.title,
						map: match.map,
						isRanked: match.isRanked,
						players: (match.players ?? []).map((player) => ({
							name: player.name || player.profile?.alias || '',
							steamId: player.steamId ?? null
						})),
						result: match.result as CommunityMatchDetail['result'] | null
					};
				}
			},
			hiddenMatches: {
				isHidden: async (sessionId) => !!(await findHiddenMatch(sessionId)),
				setHidden: async (sessionId, hidden) => {
					if (hidden) {
						await hideMatch(sessionId);
					} else {
						await unhideMatch(sessionId);
					}
				}
			},
			profile: {
				steamId: () =>
					pickOwnedSteamId(app.features.auth.user.steamIds, [
						page.url.searchParams.get('steamId'),
						app.game.profile?.steam.steamid
					]),
				get: (steamId) => unwrapApi(api.players.getCustomization(steamId)),
				save: async ({ links, background, ...input }) => {
					const current = await unwrapApi(api.players.getCustomization(input.steamId));
					const built = buildProfileLinks(links, current.links);
					if (built.isErr()) {
						throw new Error(built.error.message);
					}

					return unwrapApi(
						api.players.updateCustomization({
							...input,
							links: built.value,
							background: background ?? undefined
						})
					);
				}
			},
			labels: {
				forSteamId: (steamId) => {
					preloadPlayerLabels([steamId]);
					return labelsForSteamId(steamId);
				}
			},
			streaming: {
				isLive: (steamId) => isStreamerLive(steamId)
			},
			rewards: {
				forPlayer: (steamId) => unwrapApi(api.rewards.forPlayer(steamId))
			},
			tournaments: {
				list: (scope) => unwrapApi(api.tournaments.list(scope)),
				get: (id) => unwrapApi(api.tournaments.get(id)),
				wonBy: (steamId) => unwrapApi(api.tournaments.wonBy(steamId)),
				create: (input, images) => unwrapApi(api.tournaments.create(input, images)),
				update: (id, input, images) => unwrapApi(api.tournaments.update(id, input, images)),
				listMaps: () => unwrapApi(api.tournaments.listMaps()),
				createMap: (name, icon) => unwrapApi(api.tournaments.createMap(name, icon)),
				register: (id, steamId, acceptRules) =>
					unwrapApi(api.tournaments.register(id, steamId, acceptRules)),
				acceptRules: (id) => unwrapApi(api.tournaments.acceptRules(id)),
				withdraw: (id) => unwrapApi(api.tournaments.withdraw(id)),
				seed: (id) => unwrapApi(api.tournaments.seed(id)),
				setSeeds: (id, order) => unwrapApi(api.tournaments.setSeeds(id, order)),
				start: (id) => unwrapApi(api.tournaments.start(id)),
				setMatchResult: (id, matchId, result) =>
					unwrapApi(api.tournaments.setMatchResult(id, matchId, result)),
				disqualify: (id, participantId) => unwrapApi(api.tournaments.disqualify(id, participantId)),
				setRoundDeadlines: (id, rounds) => unwrapApi(api.tournaments.setRoundDeadlines(id, rounds)),
				setMatchDeadline: (id, matchId, deadline) =>
					unwrapApi(api.tournaments.setMatchDeadline(id, matchId, deadline)),
				mine: () => unwrapApi(api.tournaments.mine()),
				markSeen: (seen) => unwrapApi(api.tournaments.markSeen(seen)),
				createPost: (id, input) => unwrapApi(api.tournaments.createPost(id, input)),
				updatePost: (id, postId, input) => unwrapApi(api.tournaments.updatePost(id, postId, input)),
				deletePost: (id, postId) => unwrapApi(api.tournaments.deletePost(id, postId)),
				report: (id, matchId, report) => unwrapApi(api.tournaments.report(id, matchId, report)),
				reports: (id) => unwrapApi(api.tournaments.reports(id)),
				updateReport: (id, reportId, update) =>
					unwrapApi(api.tournaments.updateReport(id, reportId, update)),
				proposeTimes: (id, matchId, times) =>
					unwrapApi(api.tournaments.proposeTimes(id, matchId, times)),
				acceptTime: (id, matchId, proposalId, time) =>
					unwrapApi(api.tournaments.acceptTime(id, matchId, proposalId, time)),
				declineTimes: (id, matchId, proposalId) =>
					unwrapApi(api.tournaments.declineTimes(id, matchId, proposalId)),
				setMatchTime: (id, matchId, scheduledAt) =>
					unwrapApi(api.tournaments.setMatchTime(id, matchId, scheduledAt)),
				feature: (id, matchId) => unwrapApi(api.tournaments.feature(id, matchId)),
				stats: (idOrSlug) => unwrapApi(api.tournaments.stats(idOrSlug)),
				hallOfFame: () => unwrapApi(api.tournaments.hallOfFame())
			},
			staff: {
				getCompanionUser: async (steamId) => {
					const user = await findCompanionUserBySteamId(steamId);
					if (!user) {
						return null;
					}

					return {
						id: user.id,
						email: user.email,
						role: user.role,
						lastLogin: user.lastLogin,
						created: user.created,
						updated: user.updated,
						appVersion: readMetaVersion(user.meta)
					};
				}
			},
			// Backed by the realtime inbox service (toasts + Windows notifications live there).
			notifications: {
				list: async () => {
					await app.notifications.refresh();
					return app.notifications.items.map((item) => ({
						id: item.id,
						title: item.title,
						body: item.body,
						created: String(item.created),
						read: item.read,
						lobby: item.lobby || undefined,
						comment: item.comment || undefined,
						replay: item.replay || undefined,
						replayComment: item.replayComment || undefined,
						url: item.url || undefined,
						tournament: item.tournament || undefined
					}));
				},
				unreadCount: async () => app.notifications.unreadCount,
				markRead: (id) => app.notifications.markRead(id),
				subscribe: (onChange) => app.notifications.onChange(onChange)
			}
		}
	});
}
