<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import BroadcastIcon from 'phosphor-svelte/lib/BroadcastIcon';
	import { tooltip } from '../attachments';
	import { tryUseHost } from '../host/host.context';
	import { isStreamer } from '../format/labels';
	import type { PlayerLabel } from '../format/types';

	type Props = {
		/** Labels already on hand; otherwise the host loads them for `steamId`. */
		labels?: PlayerLabel[] | null;
		/** Also decides whether the icon turns green (streaming right now). */
		steamId?: string | null;
		size?: number;
		class?: string;
	};

	let { labels, steamId, size = 16, class: className }: Props = $props();
	const { t } = useI18n();
	const host = tryUseHost();
	const resolved = $derived(
		labels ?? (steamId && host ? host.api.labels.forSteamId(steamId) : null)
	);
	const isLive = $derived(Boolean(steamId && host?.api.streaming.isLive(steamId)));
</script>

{#if isStreamer(resolved)}
	<span
		role="img"
		aria-label={isLive ? t('Streaming now') : t('Streamer')}
		class={cn('inline-flex shrink-0', isLive ? 'text-success' : 'text-[#9146FF]', className)}
		{@attach tooltip(isLive ? t('Streaming now') : t('Streamer'))}
	>
		<BroadcastIcon {size} weight="bold" />
	</span>
{/if}
