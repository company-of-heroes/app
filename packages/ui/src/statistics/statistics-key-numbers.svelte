<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { useHost } from '../host/host.context';
	import { formatCount } from './format';
	import { keyNumbersGrid } from './layout';
	import type { StatisticsHeadline } from './types';

	type Props = {
		headline: StatisticsHeadline;
		class?: string;
	};

	let { headline, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const tiles = $derived([
		{ key: 'total', label: t('Matches stored'), value: headline.totalMatches },
		{ key: 'today', label: t('Today'), value: headline.matchesToday },
		{ key: 'live', label: t('Live now'), value: headline.liveNow, live: true },
		{ key: 'replays', label: t('Replays uploaded'), value: headline.replaysUploaded }
	]);
</script>

<dl class={cn(keyNumbersGrid, className)}>
	{#each tiles as tile (tile.key)}
		<div class="px-4 py-3">
			<dt class="text-secondary-400 flex items-center gap-1.5 text-xs">
				{#if tile.live && tile.value > 0}
					<span class="size-1.5 animate-pulse rounded-full bg-green-400"></span>
				{/if}
				{tile.label}
			</dt>
			<dd class="font-heading mt-0.5 text-xl font-bold text-white tabular-nums">
				{formatCount(tile.value, host.locale())}
			</dd>
		</div>
	{/each}
</dl>
