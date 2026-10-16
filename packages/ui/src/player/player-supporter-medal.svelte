<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tooltip } from '../attachments';
	import { tryUseHost } from '../host/host.context';
	import { isSupporter } from '../format/labels';
	import type { PlayerLabel } from '../format/types';

	type Props = {
		/** Labels already on hand; otherwise the host loads them for `steamId`. */
		labels?: PlayerLabel[] | null;
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
	const medalUrl = $derived(host?.resolve.supporterMedal() ?? '');
</script>

{#if medalUrl && isSupporter(resolved)}
	<span
		role="img"
		aria-label={t('Supporter')}
		class={cn('inline-flex shrink-0', className)}
		{@attach tooltip(t('Supporter'))}
	>
		<img src={medalUrl} alt="" width={Math.round((size * 64) / 116)} height={size} />
	</span>
{/if}
