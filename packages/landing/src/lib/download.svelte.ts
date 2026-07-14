import { RELEASE_PAGE_URL } from './urls';

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/fknoobs/app/releases/latest';

export type LatestDownload = {
	url: string;
	fileName?: string;
	loading: boolean;
};

export const latestDownload = $state<LatestDownload>({
	url: RELEASE_PAGE_URL,
	loading: true
});

export async function loadLatestDownload(): Promise<void> {
	try {
		const response = await fetch(GITHUB_LATEST_RELEASE_API, {
			headers: { Accept: 'application/vnd.github+json' }
		});

		if (!response.ok) {
			throw new Error(`GitHub API ${response.status}`);
		}

		const release = (await response.json()) as {
			assets?: Array<{ name?: string; browser_download_url?: string }>;
		};

		const msi = release.assets?.find(
			(asset) => /\.msi$/i.test(asset.name ?? '') && asset.browser_download_url
		);

		if (msi?.browser_download_url) {
			latestDownload.url = msi.browser_download_url;
			latestDownload.fileName = msi.name;
		}
	} catch (error) {
		console.warn('[landing] failed to resolve latest MSI download:', error);
	} finally {
		latestDownload.loading = false;
	}
}
