import { goto, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { confirm } from '@tauri-apps/plugin-dialog';
import { provideHost, type HostContext } from '@company-of-heroes/ui/host';
import { toast } from '@company-of-heroes/ui/toasts';
import { getI18n, t } from '$lib/i18n';
import { replayHref } from '$lib/library/community';
import { actionIcon, defaultMapImage, doctrineBanner, factionFlag, mapImage } from '$lib/media';

const offline = () => Promise.reject(new Error(t('Not available in the Replay Manager.')));

/**
 * Wiring for shared `@company-of-heroes/ui` components. The Replay Manager is fully local:
 * only image resolvers and notifications are real; account / community ports are inert.
 */
export function provideLocalHost(): HostContext {
	return provideHost({
		locale: () => getI18n().getLocale(),
		href: (path) => path,
		routes: {
			player: () => '/',
			match: replayHref,
			accountProfile: () => '/',
			playerCardUrl: () => '',
			login: () => '/',
			memberReplays: () => '/',
			memberReplay: replayHref,
			publishReplay: () => '/',
			replayList: () => '/',
			tournaments: () => '/',
			tournament: () => '/',
			tournamentNew: () => '/',
			tournamentEdit: () => '/',
			tournamentHallOfFame: () => '/',
			guides: () => '/',
			guide: () => '/',
			guideIn: () => '/',
			guidesManage: () => '/',
			guideEdit: () => '/'
		},
		url: {
			param: (name) => page.url.searchParams.get(name),
			dropParam: (name) => {
				if (!page.url.searchParams.has(name)) {
					return;
				}

				const url = new URL(page.url.href);
				url.searchParams.delete(name);
				replaceState(`${url.pathname}${url.search}`, page.state);
			},
			goto: (path) => goto(path)
		},
		resolve: {
			flagImageUrl: () => null,
			avatarUrl: (url) => url,
			mapSrc: (map) => mapImage(map),
			mapFallbackSrc: () => defaultMapImage,
			factionFlagByRace: factionFlag,
			factionFlagByLeaderboard: () => factionFlag(0),
			rankImageByRace: () => '',
			rankImageByLeaderboard: () => '',
			doctrineBanner,
			actionIcon,
			medals: () => [],
			ribbons: () => [],
			supporterMedal: () => '',
			filesOrigin: () => '',
			userAvatar: () => undefined
		},
		auth: {
			user: null,
			isSelf: () => false,
			isSelfAlias: () => false
		},
		openNotification: () => {},
		notify: {
			success: (message) => toast.success(message),
			error: (message) => toast.error(message),
			confirm: (message, labels) =>
				confirm(message, {
					okLabel: labels?.confirm ?? t('OK'),
					cancelLabel: labels?.cancel ?? t('Cancel'),
					kind: 'warning'
				})
		},
		api: {
			players: {
				getPreview: async () => null,
				search: async () => [],
				searchPage: async () => ({ items: [], total: 0, more: false }),
				getElo: async () => ({}),
				getStats: async () => null,
				headToHead: async () => ({}),
				headToHeadMatches: async () => []
			},
			social: {
				getMyVote: async () => 0,
				setVote: offline
			},
			comments: {
				list: async () => [],
				create: offline,
				update: offline,
				remove: offline,
				vote: offline,
				searchMentions: async () => []
			},
			replays: {
				previewRatings: offline,
				upload: offline,
				publishFromMatch: offline,
				loadMatchForPublish: offline,
				update: offline,
				remove: offline,
				getFile: offline,
				downloadHref: () => null,
				download: offline
			},
			hiddenMatches: {
				isHidden: async () => false,
				setHidden: offline
			},
			profile: {
				steamId: () => null,
				get: offline,
				save: offline
			},
			labels: {
				forSteamId: () => []
			},
			streaming: {
				isLive: () => false
			},
			rewards: {
				forPlayer: offline
			},
			tournaments: {
				list: offline,
				get: offline,
				wonBy: offline,
				create: offline,
				update: offline,
				listMaps: offline,
				usedMedals: offline,
				createMap: offline,
				listMedals: offline,
				createMedal: offline,
				register: offline,
				acceptRules: offline,
				withdraw: offline,
				seed: offline,
				setSeeds: offline,
				start: offline,
				generateBracket: offline,
				discardBracket: offline,
				swapPlayers: offline,
				remove: offline,
				restore: offline,
				setMatchResult: offline,
				addParticipant: offline,
				removeParticipant: offline,
				disqualify: offline,
				setRoundDeadlines: offline,
				setMatchDeadline: offline,
				mine: offline,
				markSeen: offline,
				createPost: offline,
				updatePost: offline,
				deletePost: offline,
				report: offline,
				reports: offline,
				updateReport: offline,
				proposeTimes: offline,
				acceptTime: offline,
				declineTimes: offline,
				setMatchTime: offline,
				feature: offline,
				stats: offline,
				hallOfFame: offline,
				myHostRequest: offline,
				requestHost: offline,
				hostRequests: offline,
				decideHostRequest: offline,
				hosts: offline,
				revokeHost: offline
			},
			guides: {
				nav: offline,
				list: offline,
				resolve: offline,
				get: offline,
				mine: offline,
				create: offline,
				update: offline,
				uploadImage: offline,
				requestReview: offline,
				discardRevision: offline,
				remove: offline,
				categories: offline,
				createCategory: offline,
				updateCategory: offline,
				deleteCategory: offline,
				searchTranslations: offline
			},
			notifications: {
				list: offline,
				unreadCount: offline,
				markRead: offline
			},
			staff: {
				getCompanionUser: async () => null
			}
		}
	});
}
