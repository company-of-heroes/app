<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tooltip } from '../attachments';
	import { useHost } from '../host/host.context';

	type Props = {
		/** Rank level (insignia), 0 for unranked. */
		level: number;
		/** Faction race id; used when no leaderboard id is given. */
		race?: number | null;
		/** Relic leaderboard id; picks the insignia of that ladder. */
		leaderboardId?: number | null;
		/** Ladder position, added to the tooltip when known. */
		position?: number | null;
		class?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let {
		level,
		race = null,
		leaderboardId = null,
		position = null,
		class: className
	}: Props = $props();

	const src = $derived(
		leaderboardId != null
			? host.resolve.rankImageByLeaderboard(leaderboardId, level)
			: host.resolve.rankImageByRace(race ?? 0, level)
	);
	const label = $derived(
		position && position > 0
			? `${t('Rank level {level}', { level })} · #${position}`
			: t('Rank level {level}', { level })
	);
</script>

<!-- Rank insignia; hover shows the rank level (and ladder position). -->
<img
	{src}
	alt={label}
	loading="lazy"
	decoding="async"
	class={cn('size-5 shrink-0 object-contain', className)}
	{@attach tooltip(label)}
/>
