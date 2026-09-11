<script lang="ts">
	import { PlayerMatchHistory } from '@company-of-heroes/ui/player';
	import type { PlayerPageData, TransformedMatch } from '$lib/player';
	import { currentLocale, href, useI18n } from '$lib/i18n';
	import { normalizeMapName } from '$lib/utils/player/format';
	import { flagImageUrl, resolveFactionFlag, resolveMapSrc } from '$lib/utils/resolvers';

	type Props = {
		player: PlayerPageData;
	};

	let { player }: Props = $props();
	const { t } = useI18n();

	function playerHref(steamId: string): string {
		return href(`/players/${steamId}`);
	}

	function detailsHref(match: TransformedMatch): string | null {
		if (!match.lobbyId) {
			return null;
		}

		return href(`/replays/${match.lobbyId}`);
	}

	function formatSessionId(id: number): string {
		return t('ID: {id}', { id });
	}

	function formatTimestamp(unixSeconds: number): string {
		const date = new Date(unixSeconds * 1000);
		const datePart = new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
		const timePart = new Intl.DateTimeFormat('en', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(date);
		return `${datePart} · ${timePart}`;
	}
</script>

<PlayerMatchHistory
	{player}
	{flagImageUrl}
	{playerHref}
	resolveFactionFlag={resolveFactionFlag}
	resolveMapSrc={resolveMapSrc}
	formatMapName={normalizeMapName}
	{formatTimestamp}
	locale={currentLocale()}
	showAvatars={false}
	emptyMessage={t('No recent Relic matches found.')}
	changeLabel={t('Change')}
	teamLabel={t('Team')}
	eloLabel={t('ELO')}
	playerLabel={t('Player')}
	winsLabel={t('Wins')}
	lossesLabel={t('Losses')}
	streakLabel={t('Streak')}
	showSessionId
	{detailsHref}
	detailsLabel={t('View details')}
	{formatSessionId}
/>
