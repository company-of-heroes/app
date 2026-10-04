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
			login: () => '/',
			memberReplays: () => '/',
			memberReplay: replayHref,
			publishReplay: () => '/',
			replayList: () => '/'
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
			userAvatar: () => undefined
		},
		auth: {
			user: null,
			isSelf: () => false,
			isSelfAlias: () => false
		},
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
				getElo: async () => ({})
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
			staff: {
				getCompanionUser: async () => null
			}
		}
	});
}
