<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import { Button } from '../ui/button';
	import { tooltip } from '../attachments';
	import { useHost } from '../host/host.context';
	import type { CommunityMatch, CommunityMatchDetail } from '../replay/types';

	type Props = {
		match: CommunityMatch;
		/** `primary`: labelled call to action; `icon`: compact square button. */
		variant?: 'primary' | 'icon';
		/** Called with the new count after a counted download. */
		onDownloaded?: (downloadCount: number) => void;
		class?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let { match, variant = 'primary', onDownloaded, class: className }: Props = $props();

	let downloading = $state(false);

	const detail = $derived<CommunityMatchDetail>({
		...match,
		durationSeconds: match.durationSeconds ?? null
	});
	/** A browser download link (website); the desktop app saves the file itself. */
	const href = $derived(host.api.replays.downloadHref(detail));
	const label = $derived(t('Download replay'));
	const hint = $derived(
		href
			? t(
					'Put the file in your Company of Heroes playback folder, then open it under Replays in the game.'
				)
			: t('Saves the replay to your playback folder, ready under Replays in the game.')
	);

	async function watch() {
		if (downloading) {
			return;
		}

		downloading = true;
		try {
			const result = await host.api.replays.download(detail);
			if (result?.downloadCount != null) {
				onDownloaded?.(result.downloadCount);
			}
		} catch {
			// The host reports download failures itself.
		} finally {
			downloading = false;
		}
	}
</script>

{#if variant === 'icon'}
	<Button
		href={href ?? undefined}
		download={href ? '' : undefined}
		onclick={() => void watch()}
		loading={downloading && !href}
		variant="ghost"
		size="icon-sm"
		class={cn('text-secondary-300 hover:text-primary', className)}
		aria-label={label}
		{@attach tooltip(`${label} · ${hint}`)}
	>
		<DownloadSimpleIcon class="size-4" weight="bold" />
	</Button>
{:else}
	<Button
		href={href ?? undefined}
		download={href ? '' : undefined}
		onclick={() => void watch()}
		loading={downloading && !href}
		variant="primary"
		class={cn('whitespace-nowrap', className)}
		{@attach tooltip(hint)}
	>
		<DownloadSimpleIcon class="size-4" weight="bold" />
		{label}
	</Button>
{/if}
