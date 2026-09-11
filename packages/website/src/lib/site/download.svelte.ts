import { RELEASE_PAGE_URL } from './urls';

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/fknoobs/app/releases/latest';

export type LatestDownload = {
	url: string;
	fileName?: string;
	loading: boolean;
};

function emptyDownload(): LatestDownload {
	return {
		url: RELEASE_PAGE_URL,
		loading: true
	};
}

export const latestDownload = $state<LatestDownload>(emptyDownload());
export const linuxDownload = $state<LatestDownload>(emptyDownload());

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
		applyAsset(
			latestDownload,
			pickAsset(assets, /setup\.exe$/i) ?? pickAsset(assets, /\.exe$/i) ?? pickAsset(assets, /\.msi$/i)
		);
		applyAsset(linuxDownload, pickAsset(assets, /\.AppImage$/i));
	} catch (error) {
		console.warn('[landing] failed to resolve latest downloads:', error);
	} finally {
		latestDownload.loading = false;
		linuxDownload.loading = false;
	}
}
