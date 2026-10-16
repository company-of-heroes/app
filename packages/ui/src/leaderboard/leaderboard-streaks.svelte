<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { formatStreak, statStreakPositive } from '@company-of-heroes/ui/variants';
	import FireIcon from 'phosphor-svelte/lib/FireIcon';
	import { useLeaderboard } from './context';
	import { hotStreaks } from './highlights';
	import LeaderboardPanel from './leaderboard-panel.svelte';
	import LeaderboardSideRow from './leaderboard-side-row.svelte';

	const { t } = useI18n();
	const leaderboard = useLeaderboard();

	const players = $derived(hotStreaks(leaderboard.stats));
</script>

<LeaderboardPanel title={t('Hot streaks')}>
	{#if players.length === 0}
		<p class="text-secondary-400 px-4 pb-4 text-sm">{t('No win streaks of 3 or more right now.')}</p>
	{:else}
		<ol class="pb-2">
			{#each players as stat (stat.profile.profile_id)}
				<LeaderboardSideRow {stat}>
					{#snippet trailing()}
						<span class="inline-flex items-center gap-1 font-semibold {statStreakPositive}">
							<FireIcon class="size-3.5" weight="fill" />
							{formatStreak(stat.streak)}
						</span>
					{/snippet}
				</LeaderboardSideRow>
			{/each}
		</ol>
	{/if}
</LeaderboardPanel>
