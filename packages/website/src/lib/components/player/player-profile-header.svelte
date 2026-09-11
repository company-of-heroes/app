<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PlayerProfileHeader } from '@company-of-heroes/ui/player';
	import type { PerformanceRecentMatch, PlayerPageData } from '$lib/player';
	import { flagImageUrl, resolveAvatarUrl, resolveMapSrc, smurfLenderHref } from '$lib/utils/resolvers';
	import { currentLocale, href, useI18n } from '$lib/i18n';

	type Props = {
		player: PlayerPageData;
		afterName?: Snippet;
		afterDetails?: Snippet;
		vote?: Snippet;
	};

	let { player, afterName, afterDetails, vote }: Props = $props();
	const { t } = useI18n();

	const joinedSince = $derived.by(() => {
		if (!player.timecreated) {
			return null;
		}

		return new Intl.DateTimeFormat(currentLocale(), {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(player.timecreated * 1000));
	});

	function matchHref(match: PerformanceRecentMatch): string | null {
		if (!match.id) {
			return null;
		}

		return href(`/replays/${match.id}`);
	}
</script>

<PlayerProfileHeader
	{player}
	{flagImageUrl}
	{resolveAvatarUrl}
	{smurfLenderHref}
	{resolveMapSrc}
	{matchHref}
	{afterName}
	{afterDetails}
	{vote}
	{joinedSince}
	levelLabel={t('Level {level}', { level: player.level })}
	steamIdLabel={t('Steam ID:')}
	trackedLabel={t('Tracked:')}
	joinedSinceLabel={t('Joined since:')}
	smurfLabel={t('Smurf account:')}
	recordLabel={t('Record:')}
	recentLabel={t('Recent:')}
	bestMapLabel={t('Best map:')}
	emptyTrackedLabel={t('No community matches recorded yet.')}
	winLabel={t('Win')}
	lossLabel={t('Loss')}
/>
