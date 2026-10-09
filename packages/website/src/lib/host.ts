import { dev } from '$app/environment';
import { afterNavigate, goto, invalidateAll, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { provideHost, type HostContext } from '@company-of-heroes/ui/host';
import type { CommunityMatchDetail } from '@company-of-heroes/ui/replay';
import { authDisplayName, isStaffUser, loginRedirectHref, meSteamIds } from '$lib/auth/user';
import { toast } from '@company-of-heroes/ui/toasts';
import { currentLocale, href, unlocalizedPath } from '$lib/i18n';
import { rememberReplaysListHref, rememberedReplaysListHref } from '$lib/replays';
import { RELEASE_PAGE_URL, SITE_URL } from '$lib/site/urls';
import { modal } from '@company-of-heroes/ui/modal';
import { NotificationDetail, type HostNotification } from '@company-of-heroes/ui/notifications';
import {
	listNotifications,
	markNotificationRead,
	unreadNotifications
} from '$lib/remote/notifications.remote';
import {
	hasCountedReplayDownload,
	markReplayDownload,
	replayDownloadVisitorId
} from '$lib/replays/downloads';
import { getHiddenMatch, hideMatch, unhideMatch } from '$lib/remote/hidden-matches.remote';
import { reportDocsIssue, saveDocsNote } from '$lib/remote/docs.remote';
import {
	createTournament,
	createTournamentMap,
	disqualifyTournamentPlayer,
	markTournamentGamesSeen,
	createTournamentPost,
	updateTournamentPost,
	deleteTournamentPost,
	reportTournamentMatch,
	myTournaments,
	acceptTournamentRules,
	listTournamentReports,
	updateTournamentReport,
	proposeTournamentTimes,
	acceptTournamentTime,
	declineTournamentTimes,
	setTournamentMatchTime,
	featureTournamentMatch,
	tournamentStats,
	tournamentHallOfFame,
	setTournamentMatchDeadline,
	setTournamentRoundDeadlines,
	fetchTournament,
	joinTournament,
	listTournamentMaps,
	listTournaments,
	listTournamentsWonBy,
	seedTournament,
	setTournamentMatchResult,
	setTournamentSeeds,
	startTournament,
	updateTournament,
	withdrawFromTournament
} from '$lib/remote/tournaments.remote';
import { getCompanionUser } from '$lib/remote/companion-user.remote';
import {
	getProfileCustomization,
	saveProfileCustomization
} from '$lib/remote/profile-customization.remote';
import { pickOwnedSteamId } from '@company-of-heroes/api';
import { getPlayerElo, getPlayerPreview, getPlayerStats } from '$lib/remote/player-preview.remote';
import {
	attachMatchReplay,
	previewMemberReplayRatings,
	publishMatchAsMemberReplay,
	deleteMemberReplay,
	recordReplayDownload,
	updateMemberReplay,
	searchPlayersForUpload,
	uploadMemberReplay
} from '$lib/remote/replays.remote';
import { getMyPlayerVote, getPlayerLabels, setPlayerVote } from '$lib/remote/player-social.remote';
import { getPlayerRewards } from '$lib/remote/rewards.remote';
import { getLiveStreamerIds } from '$lib/remote/streaming.remote';
import {
	createComment,
	deleteComment,
	getMyVote,
	listComments,
	searchMentionUsers,
	updateComment,
	vote,
	voteComment
} from '$lib/remote/match-social.remote';
import { getFactionFlagByLeaderboardId } from '$lib/utils/media/ranks';
import { getActionIcon } from '$lib/utils/media/action-icons';
import { getMedals } from '$lib/utils/media/medals';
import {
	flagImageUrl,
	getRankImageByLeaderboardId,
	getRankImageByRace,
	resolveAvatarUrl,
	resolveFactionFlag,
	resolveMapSrc
} from '$lib/utils/resolvers';

/** Remote functions reject with `{ status, body: { message } }`; shared components show `Error.message`. */
async function withMessage<T>(promise: PromiseLike<T>): Promise<T> {
	try {
		return await promise;
	} catch (error) {
		const message = (error as { body?: { message?: unknown } })?.body?.message;
		throw typeof message === 'string' && message ? new Error(message) : error;
	}
}

/** A notification `url` on this site (or coh1stats.com) as a localized internal path. */
function internalPath(url: string | undefined): string | null {
	if (!url) {
		return null;
	}

	try {
		const target = new URL(url);
		if (target.origin !== page.url.origin && target.origin !== SITE_URL) {
			return null;
		}

		return href(`${unlocalizedPath(target.pathname)}${target.search}${target.hash}`);
	} catch {
		return null;
	}
}

function withComment(path: string, commentId: string | undefined): string {
	return commentId ? `${path}?comment=${encodeURIComponent(commentId)}` : path;
}

/** Bell: go to the page the notification is about, else show its body. */
function openNotification(notification: HostNotification) {
	const internal = internalPath(notification.url);
	if (internal) {
		void goto(internal);
		return;
	}

	if (notification.lobby) {
		void goto(withComment(href(`/replays/${notification.lobby}`), notification.comment));
		return;
	}

	if (notification.replay) {
		void goto(withComment(href(`/replays/${notification.replay}`), notification.replayComment));
		return;
	}

	modal.create({
		component: NotificationDetail,
		title: notification.title,
		props: { body: notification.body, url: notification.url },
		size: 'md'
	});
	modal.open();
}

/** Website wiring for shared `@company-of-heroes/ui` components. Call once in the root layout. */
export function provideWebsiteHost(): HostContext {
	// Replay detail pages link back to the list (with its filters) the visitor came from.
	afterNavigate(({ from }) => {
		const path = from?.url?.pathname;
		if (path && unlocalizedPath(path) === '/replays') {
			rememberReplaysListHref(`${path}${from.url.search}`);
		}
	});

	return provideHost({
		locale: () => currentLocale(),
		href: (path) => href(path),
		routes: {
			player: (id) => href(`/players/${id}`),
			match: (lobbyId) => href(`/replays/${lobbyId}`),
			accountProfile: (steamId) => href(`/account/profile?steamId=${steamId}`),
			login: () => loginRedirectHref(`${page.url.pathname}${page.url.search}`, currentLocale()),
			memberReplays: () => href('/replays?tab=member'),
			memberReplay: (id) => href(`/replays/${id}`),
			publishReplay: (lobbyId) => href(`/replays/upload?fromMatch=${lobbyId}`),
			replayList: () => href(rememberedReplaysListHref()),
			shareReplay: (id) => `${page.url.origin}${href(`/replays/${id}`)}`,
			editReplay: (id) => href(`/replays/${id}/edit`),
			tournaments: () => href('/tournaments'),
			tournament: (slug) => href(`/tournaments/${slug}`),
			tournamentNew: () => href('/tournaments/new'),
			tournamentEdit: (slug) => href(`/tournaments/${slug}/edit`),
			downloadApp: () => RELEASE_PAGE_URL,
			tournamentHallOfFame: () => href('/tournaments/hall-of-fame'),
			tournamentSimulator: dev
				? (slug) => href(slug ? `/tournaments/simulate?slug=${slug}` : '/tournaments/simulate')
				: undefined
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
			avatarUrl: resolveAvatarUrl,
			mapSrc: resolveMapSrc,
			mapFallbackSrc: () => resolveMapSrc(undefined),
			factionFlagByRace: resolveFactionFlag,
			factionFlagByLeaderboard: getFactionFlagByLeaderboardId,
			rankImageByRace: getRankImageByRace,
			rankImageByLeaderboard: getRankImageByLeaderboardId,
			doctrineBanner: (file) => `/doctrines/${file}`,
			actionIcon: getActionIcon,
			medals: getMedals,
			userAvatar: (user) => user.avatarUrl
		},
		auth: {
			get user() {
				const user = page.data.user;
				if (!user) {
					return null;
				}

				return {
					id: user.id,
					name: authDisplayName(user),
					avatarUrl: user.avatarUrl,
					steamIds: meSteamIds(user),
					isStaff: isStaffUser(user)
				};
			},
			isSelf: (steamId) => meSteamIds(page.data.user).includes(steamId),
			isSelfAlias: () => false
		},
		openNotification,
		notify: {
			success: (message) => toast.success(message),
			error: (message) => toast.error(message),
			confirm: async (message) => window.confirm(message)
		},
		api: {
			players: {
				getPreview: (id) => getPlayerPreview(id),
				search: (q) => searchPlayersForUpload({ q }),
				getElo: (steamId) => getPlayerElo(steamId),
				getStats: (id) => getPlayerStats(id)
			},
			social: {
				getMyVote: ({ kind, id }) =>
					kind === 'player' ? getMyPlayerVote(id) : getMyVote({ kind, targetId: id }),
				setVote: ({ kind, id }, value) =>
					kind === 'player'
						? setPlayerVote({ steamId: id, value })
						: vote({ kind, targetId: id, value })
			},
			comments: {
				list: ({ kind, id }) => listComments({ kind, targetId: id }),
				create: ({ kind, id }, text, parentId) =>
					createComment({ kind, targetId: id, text, parentId }),
				update: (kind, commentId, text) => updateComment({ kind, commentId, text }),
				remove: (kind, commentId, note) => deleteComment({ kind, commentId, note }),
				vote: (kind, commentId, value) => voteComment({ kind, commentId, value }),
				searchMentions: (query) => searchMentionUsers(query)
			},
			replays: {
				previewRatings: (input) => previewMemberReplayRatings(input),
				upload: (input) => uploadMemberReplay(input),
				publishFromMatch: (lobbyId, input) =>
					publishMatchAsMemberReplay({ lobbyId, ...input }).then(({ id }) => ({ id })),
				update: (id, input) => updateMemberReplay({ id, ...input }),
				remove: (id) => deleteMemberReplay({ id }),
				getFile: async (match) => {
					const response = await fetch(`/api/replay-file/${match.id}`);
					if (!response.ok) {
						throw new Error(
							response.status === 429
								? 'Too many replay downloads from this network. Try again in a moment.'
								: 'Could not download the replay file.'
						);
					}

					return new Uint8Array(await response.arrayBuffer());
				},
				downloadHref: (match) => `/api/replay-file/${match.id}?download=1`,
				/** The link downloads; this only counts unique downloads per visitor. */
				download: async (match) => {
					if (hasCountedReplayDownload(match.id)) {
						return;
					}

					const result = await recordReplayDownload({
						matchId: match.id,
						visitorId: replayDownloadVisitorId(),
						kind: match.kind === 'member' ? 'member' : 'match'
					});
					markReplayDownload(match.id);
					return result.counted ? { downloadCount: (match.downloadCount ?? 0) + 1 } : undefined;
				},
				attach: async (lobbyId, file, durationSeconds) => {
					const result = await attachMatchReplay({ lobbyId, file, durationSeconds });
					await invalidateAll();
					return result;
				},
				loadMatchForPublish: async (lobbyId) => {
					// Ownership / already-published checks run in the upload page load.
					const response = await fetch(`/api/replay-file/${lobbyId}`);
					if (!response.ok) {
						throw new Error('This match has no replay file.');
					}

					const buffer = await response.arrayBuffer();
					const fromMatch = page.data.fromMatch as CommunityMatchDetail | null | undefined;
					const match = fromMatch?.id === lobbyId ? fromMatch : null;
					return {
						file: new File([buffer], `${lobbyId}.rec`, { type: 'application/octet-stream' }),
						isRanked: match?.isRanked,
						players: (match?.players ?? []).map((player) => ({
							name: player.profile?.alias || '',
							steamId: player.steamId ?? null
						})),
						result: match?.result ?? null
					};
				}
			},
			hiddenMatches: {
				isHidden: (sessionId) => getHiddenMatch(sessionId),
				setHidden: (sessionId, hidden) => (hidden ? hideMatch(sessionId) : unhideMatch(sessionId))
			},
			profile: {
				steamId: () =>
					pickOwnedSteamId(meSteamIds(page.data.user), [page.url.searchParams.get('steamId')]),
				get: (steamId) => getProfileCustomization(steamId),
				save: (input) => saveProfileCustomization(input)
			},
			labels: {
				forSteamId: (steamId) => getPlayerLabels(steamId).current ?? []
			},
			docs: {
				saveNote: (kind, slug, body) => saveDocsNote({ kind, slug, body }),
				reportIssue: (title, description) =>
					reportDocsIssue({
						path: `${page.url.pathname}${page.url.search}`,
						page: title,
						description
					})
			},
			streaming: {
				isLive: (steamId) => (getLiveStreamerIds().current ?? []).includes(steamId)
			},
			rewards: {
				forPlayer: (steamId) => getPlayerRewards(steamId)
			},
			tournaments: {
				list: (scope) => withMessage(listTournaments({ scope })),
				get: (id) => withMessage(fetchTournament(id)),
				wonBy: (steamId) => withMessage(listTournamentsWonBy(steamId)),
				create: (input, images = {}) => withMessage(createTournament({ input, images })),
				update: (id, input, images = {}) => withMessage(updateTournament({ id, input, images })),
				listMaps: () => withMessage(listTournamentMaps()),
				createMap: (name, icon) => withMessage(createTournamentMap({ name, icon })),
				register: (id, steamId, acceptRules) =>
					withMessage(joinTournament({ id, steamId, acceptRules })),
				acceptRules: (id) => withMessage(acceptTournamentRules(id)),
				withdraw: (id) => withMessage(withdrawFromTournament(id)),
				seed: (id) => withMessage(seedTournament(id)),
				setSeeds: (id, order) => withMessage(setTournamentSeeds({ id, order })),
				start: (id) => withMessage(startTournament(id)),
				setMatchResult: (id, matchId, result) =>
					withMessage(setTournamentMatchResult({ id, matchId, result })),
				disqualify: (id, participantId) =>
					withMessage(disqualifyTournamentPlayer({ id, participantId })),
				setRoundDeadlines: (id, rounds) => withMessage(setTournamentRoundDeadlines({ id, rounds })),
				setMatchDeadline: (id, matchId, deadline) =>
					withMessage(setTournamentMatchDeadline({ id, matchId, deadline })),
				mine: () => withMessage(myTournaments()),
				markSeen: (seen) => withMessage(markTournamentGamesSeen(seen)),
				createPost: (id, input) => withMessage(createTournamentPost({ id, ...input })),
				updatePost: (id, postId, input) =>
					withMessage(updateTournamentPost({ id, postId, ...input })),
				deletePost: (id, postId) => withMessage(deleteTournamentPost({ id, postId })),
				report: (id, matchId, report) =>
					withMessage(reportTournamentMatch({ id, matchId, ...report })),
				reports: (id) => withMessage(listTournamentReports(id)),
				updateReport: (id, reportId, update) =>
					withMessage(updateTournamentReport({ id, reportId, ...update })),
				proposeTimes: (id, matchId, times) =>
					withMessage(proposeTournamentTimes({ id, matchId, times })),
				acceptTime: (id, matchId, proposalId, time) =>
					withMessage(acceptTournamentTime({ id, matchId, proposalId, time })),
				declineTimes: (id, matchId, proposalId) =>
					withMessage(declineTournamentTimes({ id, matchId, proposalId })),
				setMatchTime: (id, matchId, scheduledAt) =>
					withMessage(setTournamentMatchTime({ id, matchId, scheduledAt })),
				feature: (id, matchId) => withMessage(featureTournamentMatch({ id, matchId })),
				stats: (idOrSlug) => withMessage(tournamentStats(idOrSlug)),
				hallOfFame: () => withMessage(tournamentHallOfFame())
			},
			staff: {
				getCompanionUser: (steamId) => getCompanionUser(steamId)
			},
			// No realtime on the website: the bell polls `unreadCount`.
			notifications: {
				list: () => withMessage(listNotifications()),
				unreadCount: () => withMessage(unreadNotifications()),
				markRead: (id) => withMessage(markNotificationRead(id))
			}
		}
	});
}
