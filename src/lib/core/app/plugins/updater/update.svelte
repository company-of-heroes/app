<script lang="ts">
	import { app } from '$core/app/app.svelte';
	import { Button } from '$lib/components/ui/button';
	import { basename, downloadDir, sep } from '@tauri-apps/api/path';
	import { openPath } from '@tauri-apps/plugin-opener';
	import { download } from '@tauri-apps/plugin-upload';

	type Props = {
		currentVersion: number;
		latestVersion: number;
		downloadUrl: string;
	};

	let { currentVersion, latestVersion, downloadUrl }: Props = $props();
	let isDownloading = $state(false);

	const startDownload = async () => {
		isDownloading = true;
		const downloadPath = (await downloadDir()) + sep() + (await basename(downloadUrl));

		download(downloadUrl, downloadPath)
			.then(() => openPath(downloadPath))
			.finally(() => {
				isDownloading = false;
			});
	};
</script>

<div class="flex items-center gap-2">
	<Button variant="primary" onclick={async () => startDownload()} loading={isDownloading}>
		Download {latestVersion}
	</Button>
	<Button variant="secondary" onclick={() => app.modal.close()}>Later</Button>
</div>
