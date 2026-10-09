<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource } from 'runed';
	import { useHost } from '../host/host.context';
	import PlayerStatsTable from '../player/player-stats-table.svelte';

	type Props = { playerId: string };

	let { playerId }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const stats = resource(
		() => playerId,
		(id) => host.api.players.getStats(id).catch(() => null)
	);
</script>

{#if stats.loading && !stats.current}
	<PlayerStatsTable stats={[]} loading skeletonRows={4} />
{:else if stats.current}
	<PlayerStatsTable stats={stats.current.leaderboardStats} elo={stats.current.elo} />
{:else}
	<p class="text-secondary-400 px-4 py-3 text-sm">
		{t('Failed to load player stats. Please try again later.')}
	</p>
{/if}
