import { RELEASE_PAGE_URL, REPLAY_MANAGER_RELEASES_URL } from './urls';

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/fknoobs/app/releases/latest';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/fknoobs/app/releases?per_page=30';
const REPLAY_MANAGER_TAG = /^replay-parser-v/;

export type LatestDownload = {
	url: string;
	fileName?: string;
	loading: boolean;
};

function emptyDownload(url = RELEASE_PAGE_URL): LatestDownload {
	return {
		url,
		loading: true
	};
}

export const latestDownload = $state<LatestDownload>(emptyDownload());
export const linuxDownload = $state<LatestDownload>(emptyDownload());
export const replayManagerDownload = $state<LatestDownload>(
	emptyDownload(REPLAY_MANAGER_RELEASES_URL)
);

type ReleaseAsset = {
	name?: string;
	browser_download_url?: string;
};

function pickAsset(assets: ReleaseAsset[], pattern: RegExp): ReleaseAsset | undefined {
	return assets.find((asset) => pattern.test(asset.name ?? '') && asset.browser_download_url);
}

function applyAsset(target: LatestDownload, asset: ReleaseAsset | undefined): void {
	if (asset?.browser_download_url) {
		target.url = asset.browser_download_url;
		target.fileName = asset.name;
	}
}

export async function loadLatestDownload(): Promise<void> {
	try {
		const response = await fetch(GITHUB_LATEST_RELEASE_API, {
			headers: { Accept: 'application/vnd.github+json' }
		});

		if (!response.ok) {
			throw new Error(`GitHub API ${response.status}`);
		}

		const release = (await response.json()) as {
			assets?: ReleaseAsset[];
		};

		const assets = release.assets ?? [];
		applyAsset(latestDownload, pickInstaller(assets));
		applyAsset(linuxDownload, pickAsset(assets, /\.AppImage$/i));
	} catch (error) {
		console.warn('[website] failed to resolve latest downloads:', error);
	} finally {
		latestDownload.loading = false;
		linuxDownload.loading = false;
	}
}

function pickInstaller(assets: ReleaseAsset[]): ReleaseAsset | undefined {
	return (
		pickAsset(assets, /setup\.exe$/i) ?? pickAsset(assets, /\.exe$/i) ?? pickAsset(assets, /\.msi$/i)
	);
}

/**
 * Replay Manager releases are prereleases (so the companion's `releases/latest`
 * updater never picks them up); find the newest one by tag instead.
 */
export async function loadReplayManagerDownload(): Promise<void> {
	try {
		const response = await fetch(GITHUB_RELEASES_API, {
			headers: { Accept: 'application/vnd.github+json' }
		});

		if (!response.ok) {
			throw new Error(`GitHub API ${response.status}`);
		}

		const releases = (await response.json()) as {
			tag_name?: string;
			draft?: boolean;
			assets?: ReleaseAsset[];
		}[];

		const release = releases.find(
			(item) => !item.draft && REPLAY_MANAGER_TAG.test(item.tag_name ?? '')
		);
		applyAsset(replayManagerDownload, pickInstaller(release?.assets ?? []));
	} catch (error) {
		console.warn('[website] failed to resolve the Replay Manager download:', error);
	} finally {
		replayManagerDownload.loading = false;
	}
}
