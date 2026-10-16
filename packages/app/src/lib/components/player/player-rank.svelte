<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn, getRankImage, Race } from '$lib/utils';
	import { isNumber } from 'lodash-es';
	import { useI18n } from '$lib/i18n';
	import { tooltip } from '$lib/attachments';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { t } = useI18n();
	const { playerResult, stats, race } = $derived(usePlayer());
	const src = $derived.by(() => {
		if (playerResult && stats) {
			return getRankImage(playerResult.race_id, stats.ranklevel);
		}

		if (isNumber(race)) {
			return getRankImage(race, stats?.ranklevel ?? -1);
		}

		return getRankImage(Race.US, -1);
	});
	const level = $derived(stats?.ranklevel ?? 0);
	const label = $derived(level > 0 ? t('Rank level {level}', { level }) : t('Rank'));
</script>

{#if src}
	<img
		{src}
		alt={label}
		{...restProps}
		class={cn('h-6 w-6', restProps.class)}
		{@attach tooltip(label)}
	/>
{/if}
