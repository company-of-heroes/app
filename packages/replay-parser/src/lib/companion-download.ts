import { openUrl } from '@tauri-apps/plugin-opener';

const RELEASE_PAGE_URL = 'https://github.com/company-of-heroes/app/releases/latest';
const LATEST_RELEASE_API = 'https://api.github.com/repos/company-of-heroes/app/releases/latest';

type ReleaseAsset = { name?: string; browser_download_url?: string };

/** Same pick order as the website: the NSIS setup, any .exe, then the .msi. */
function pickInstaller(assets: ReleaseAsset[]): string | null {
	for (const pattern of [/setup\.exe$/i, /\.exe$/i, /\.msi$/i]) {
		const asset = assets.find((item) => pattern.test(item.name ?? '') && item.browser_download_url);
		if (asset?.browser_download_url) {
			return asset.browser_download_url;
		}
	}

	return null;
}

/**
 * Opens the companion app's latest installer, so the browser downloads it right away.
 * GitHub is only asked on click; falls back to the release page.
 */
export async function downloadCompanionApp(): Promise<void> {
	let url = RELEASE_PAGE_URL;
	try {
		const response = await fetch(LATEST_RELEASE_API, {
			headers: { Accept: 'application/vnd.github+json' }
		});
		if (response.ok) {
			const release = (await response.json()) as { assets?: ReleaseAsset[] };
			url = pickInstaller(release.assets ?? []) ?? RELEASE_PAGE_URL;
		}
	} catch (error) {
		console.warn('[replay-parser] could not resolve the companion installer', error);
	}

	await openUrl(url);
}
