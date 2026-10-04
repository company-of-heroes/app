import { afterNavigate, goto, invalidateAll, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { provideHost, type HostContext } from '@company-of-heroes/ui/host';
import type { CommunityMatchDetail } from '@company-of-heroes/ui/replay';
import { authDisplayName, isStaffUser, loginRedirectHref, meSteamIds } from '$lib/auth/user';
import { toast } from '@company-of-heroes/ui/toasts';
import { currentLocale, href, unlocalizedPath } from '$lib/i18n';
import { rememberReplaysListHref, rememberedReplaysListHref } from '$lib/replays';
import {
	hasCountedReplayDownload,
	markReplayDownload,
	replayDownloadVisitorId
} from '$lib/replays/downloads';
import { getHiddenMatch, hideMatch, unhideMatch } from '$lib/remote/hidden-matches.remote';
import { getCompanionUser } from '$lib/remote/companion-user.remote';
import {
	getProfileCustomization,
	saveProfileCustomization
} from '$lib/remote/profile-customization.remote';
import { pickOwnedSteamId } from '@company-of-heroes/api';
import { getPlayerElo, getPlayerPreview } from '$lib/remote/player-preview.remote';
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
import {
	flagImageUrl,
	getRankImageByLeaderboardId,
	getRankImageByRace,
	resolveAvatarUrl,
	resolveFactionFlag,
	resolveMapSrc
} from '$lib/utils/resolvers';

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
			editReplay: (id) => href(`/replays/${id}/edit`)
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
		notify: {
			success: (message) => toast.success(message),
			error: (message) => toast.error(message),
			confirm: async (message) => window.confirm(message)
		},
		api: {
			players: {
				getPreview: (id) => getPlayerPreview(id),
				search: (q) => searchPlayersForUpload({ q }),
				getElo: (steamId) => getPlayerElo(steamId)
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
			streaming: {
				isLive: (steamId) => (getLiveStreamerIds().current ?? []).includes(steamId)
			},
			rewards: {
				forPlayer: (steamId) => getPlayerRewards(steamId)
			},
			staff: {
				getCompanionUser: (steamId) => getCompanionUser(steamId)
			}
		}
	});
}
