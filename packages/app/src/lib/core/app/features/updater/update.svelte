<script lang="ts">
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		currentVersion: string;
		latestVersion: string;
		downloadUrl?: string;
		releaseUrl?: string;
		onBeforeDownload?: () => Promise<void> | void;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		currentVersion,
		latestVersion,
		downloadUrl,
		releaseUrl,
		onBeforeDownload,
		...restProps
	}: Props = $props();

	async function onDownload() {
		await onBeforeDownload?.();
		if (downloadUrl) await openUrl(downloadUrl);
		else if (releaseUrl) await openUrl(releaseUrl);
	}

	async function onOpenRelease() {
		if (!releaseUrl) return;
		await openUrl(releaseUrl);
	}
</script>

<div {...restProps} class={cn('space-y-4', restProps.class)}>
	<p class="text-secondary-200">
		New version <span class="font-semibold text-white">{latestVersion}</span> is available.
		You are currently on <span class="font-semibold text-white">{currentVersion}</span>.
	</p>
	<p class="text-secondary-400 text-sm">
		Before downloading, the app will back up your settings so you can safely install over the
		existing version.
	</p>

	<div class="flex flex-wrap gap-2">
		<Button type="button" onclick={onDownload}>
			{downloadUrl ? 'Download update' : 'Open release'}
		</Button>
		{#if releaseUrl}
			<Button type="button" variant="secondary" onclick={onOpenRelease}>
				View release notes
			</Button>
		{/if}
	</div>
</div>

