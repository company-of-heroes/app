import { getContext, hasContext, setContext } from 'svelte';
import { t } from '$lib/i18n';
import { rememberedHistoryListHref } from '$core/app/features/history/history-url';

export type Crumb = {
	label: string;
	href?: string;
};

const NESTED_FALLBACK: Record<string, string> = {
	replays: 'Replay',
	history: 'Match',
	players: 'Player',
	live: 'Live lobby',
	tournaments: 'Tournament'
};

const ADMIN_PAGES: Record<string, string> = {
	notifications: 'Notifications',
	users: 'Users',
	labels: 'Labels',
	reputation: 'Reputation',
	rewards: 'Rewards',
	flagged: 'Flagged',
	screenshots: 'Screenshots',
	denylist: 'Denylist',
	'hidden-matches': 'Hidden matches',
	'wiki-reports': 'Wiki reports'
};

const SECTIONS: Record<string, string> = {
	replays: 'Replays',
	history: 'Replays',
	shortcuts: 'Keybindings',
	leaderboards: 'Leaderboards',
	players: 'Players',
	streaming: 'Streaming',
	tournaments: 'Tournaments',
	settings: 'Settings',
	account: 'Account',
	admin: 'Management'
};

class Breadcrumbs {
	extra = $state<Crumb[]>([]);

	setExtra(items: Crumb[]) {
		this.extra = items;
	}
}

// String key (not runed's Symbol-based Context) so the key survives HMR re-evaluation
// of this module; otherwise consumers look up a fresh Symbol the layout never set.
const KEY = '<breadcrumbs />';

export const createBreadcrumbs = () => setContext(KEY, new Breadcrumbs());
export const useBreadcrumbs = () => {
	if (!hasContext(KEY)) {
		throw new Error(`Context "${KEY}" not found`);
	}

	return getContext<Breadcrumbs>(KEY);
};

export function crumbsFromPath(pathname: string, extra: Crumb[]): Crumb[] {
	const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

	if (parts.length === 0) {
		return [{ label: t('Dashboard') }];
	}

	if (parts[0] === 'current-game') {
		return [{ label: t('Dashboard'), href: '/' }, extra[0] ?? { label: t('Current game') }];
	}

	if (parts[0] === 'live') {
		return [{ label: t('Dashboard'), href: '/' }, extra[0] ?? { label: t('Live lobby') }];
	}

	const sectionKey = SECTIONS[parts[0]];
	if (!sectionKey) {
		return extra.length > 0 ? extra : [{ label: parts[0] }];
	}

	const sectionLabel = t(sectionKey);
	if (parts.length === 1) {
		return [{ label: sectionLabel }];
	}

	const nestedKey = NESTED_FALLBACK[parts[0]];
	const adminPage = parts[0] === 'admin' ? ADMIN_PAGES[parts[1] ?? ''] : undefined;
	const rest =
		extra.length > 0
			? extra
			: [
					{
						label: adminPage ? t(adminPage) : nestedKey ? t(nestedKey) : (parts[1] ?? sectionLabel)
					}
				];

	const href =
		parts[0] === 'replays'
			? parts[1] === 'upload'
				? '/history?tab=member'
				: '/history?tab=replays'
			: parts[0] === 'history'
				? rememberedHistoryListHref()
				: `/${parts[0]}`;
	return [{ label: sectionLabel, href }, ...rest];
}
